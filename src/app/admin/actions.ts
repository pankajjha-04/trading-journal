'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin/guard';

export interface AdminActionState {
  error?: string;
  success?: string;
}

/**
 * Grants or revokes a plan by hand — for refunds, support cases and comped
 * accounts. Every call is written to the payments log with a null provider ref
 * so it is distinguishable from a real purchase later.
 */
export async function setUserPlan(
  userId: string,
  planId: string | null,
): Promise<AdminActionState> {
  const actor = await requireAdmin();

  if (userId === actor.id && planId === null) {
    return { error: 'Removing your own plan from here is probably a mistake.' };
  }

  const admin = createAdminClient();

  if (!planId) {
    await admin.from('subscriptions').delete().eq('user_id', userId);
    revalidatePath('/admin/users');
    return { success: 'Plan removed.' };
  }

  const { data: plan } = await admin
    .from('plans')
    .select('id, interval')
    .eq('id', planId)
    .maybeSingle();

  if (!plan) return { error: 'That plan does not exist.' };

  const periodEnd =
    plan.interval === 'once'
      ? null
      : new Date(Date.now() + (plan.interval === 'year' ? 365 : 31) * 86_400_000).toISOString();

  const { error } = await admin.from('subscriptions').upsert(
    {
      user_id: userId,
      plan_id: plan.id,
      status: 'active',
      provider: 'manual',
      provider_ref: null,
      current_period_end: periodEnd,
      cancel_at_period_end: false,
    },
    { onConflict: 'user_id' },
  );

  if (error) {
    console.error('[admin:setPlan]', error.code, error.message);
    return { error: 'That change could not be saved.' };
  }

  revalidatePath('/admin/users');
  return { success: 'Plan updated.' };
}

export async function setUserRole(
  userId: string,
  role: 'user' | 'support' | 'admin',
): Promise<AdminActionState> {
  const actor = await requireAdmin();

  // Locking yourself out is a one-way door, and there is no other way back in.
  if (userId === actor.id && role !== 'admin') {
    return { error: 'You cannot remove your own admin access.' };
  }

  const admin = createAdminClient();
  const { error } = await admin.from('profiles').update({ role }).eq('id', userId);

  if (error) {
    console.error('[admin:setRole]', error.code, error.message);
    return { error: 'That change could not be saved.' };
  }

  revalidatePath('/admin/users');
  return { success: 'Role updated.' };
}
