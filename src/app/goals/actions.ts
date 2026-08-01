'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { goalSchema } from '@/lib/validations/goal';
import { echoValues } from '@/lib/forms/echo';
import type { ActionState } from '@/app/(auth)/actions';

function toFieldErrors(issues: { path: (string | number)[]; message: string }[]) {
  const out: Record<string, string> = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? 'form');
    out[key] ??= issue.message;
  }
  return out;
}

export async function createGoal(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = goalSchema.safeParse({
    accountId: formData.get('accountId'),
    metric: formData.get('metric'),
    period: formData.get('period'),
    target: formData.get('target'),
  });

  if (!parsed.success) {
    return {
      fieldErrors: toFieldErrors(parsed.error.issues),
      values: echoValues(formData, []),
      stamp: Date.now(),
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // The account is re-checked here; a tampered form must not attach a goal to
  // someone else's book.
  const { data: account } = await supabase
    .from('accounts')
    .select('id')
    .eq('id', parsed.data.accountId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!account) return { error: 'That account was not found.' };

  const { error } = await supabase.from('goals').insert({
    user_id: user.id,
    account_id: parsed.data.accountId,
    metric: parsed.data.metric,
    period: parsed.data.period,
    target: parsed.data.target,
    starts_on: new Date().toISOString().slice(0, 10),
    is_active: true,
  });

  if (error) {
    console.error('[goal:create]', error.code, error.message);
    return { error: 'We could not save that goal.' };
  }

  revalidatePath('/goals');
  return { success: 'Goal added.' };
}

export async function deleteGoal(goalId: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  await supabase.from('goals').delete().eq('id', goalId).eq('user_id', user.id);
  revalidatePath('/goals');
}
