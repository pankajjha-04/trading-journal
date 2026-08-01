'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { accountSchema } from '@/lib/validations/account';
import type { ActionState } from '@/app/(auth)/actions';
import { echoValues } from '@/lib/forms/echo';
import { countAccounts, getMembership } from '@/lib/billing/entitlements';
import { checkAccountLimit } from '@/lib/billing/plans';

function toFieldErrors(issues: { path: (string | number)[]; message: string }[]) {
  const out: Record<string, string> = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? 'form');
    out[key] ??= issue.message;
  }
  return out;
}

export async function createAccount(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = accountSchema.safeParse({
    name: formData.get('name'),
    broker: formData.get('broker') || null,
    market: formData.get('market'),
    currency: formData.get('currency'),
    startingBalance: formData.get('startingBalance'),
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

  const [membership, accountCount] = await Promise.all([
    getMembership(user.id),
    countAccounts(user.id),
  ]);
  const accountLimit = checkAccountLimit(membership.entitlements, accountCount);

  if (!accountLimit.allowed) {
    return { error: `${accountLimit.reason} Upgrade in Settings to add more.` };
  }

  const { error } = await supabase.from('accounts').insert({
    user_id: user.id,
    name: parsed.data.name,
    broker: parsed.data.broker,
    market: parsed.data.market,
    currency: parsed.data.currency,
    starting_balance: parsed.data.startingBalance,
    is_archived: false,
  });

  if (error) {
    console.error('[account:create]', error.code, error.message);
    // 23505 is the unique (user_id, name) constraint — a real, fixable mistake,
    // so it gets a specific message rather than the generic one.
    if (error.code === '23505') {
      return {
        fieldErrors: { name: 'You already have an account with that name' },
        values: echoValues(formData, []),
        stamp: Date.now(),
      };
    }
    return {
      error: 'We could not create that account. Try again in a moment.',
      values: echoValues(formData, []),
      stamp: Date.now(),
    };
  }

  revalidatePath('/dashboard');
  redirect('/dashboard');
}
