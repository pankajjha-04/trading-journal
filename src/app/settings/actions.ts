'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import {
  accountEditSchema,
  deleteAccountSchema,
  passwordSchema,
  profileSchema,
} from '@/lib/validations/settings';
import type { ActionState } from '@/app/(auth)/actions';
import { echoValues } from '@/lib/forms/echo';

function toFieldErrors(issues: { path: (string | number)[]; message: string }[]) {
  const out: Record<string, string> = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? 'form');
    out[key] ??= issue.message;
  }
  return out;
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  return { supabase, user };
}

export async function updateProfile(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = profileSchema.safeParse({
    fullName: formData.get('fullName'),
    timezone: formData.get('timezone'),
    baseCurrency: formData.get('baseCurrency'),
    theme: formData.get('theme'),
  });

  if (!parsed.success) {
    return {
      fieldErrors: toFieldErrors(parsed.error.issues),
      values: echoValues(formData),
      stamp: Date.now(),
    };
  }

  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from('profiles')
    .update({
      full_name: parsed.data.fullName,
      timezone: parsed.data.timezone,
      base_currency: parsed.data.baseCurrency,
      theme: parsed.data.theme,
    })
    .eq('id', user.id);

  if (error) {
    console.error('[profile:update]', error.code, error.message);
    return { error: 'We could not save those changes.' };
  }

  revalidatePath('/', 'layout');
  return { success: 'Profile saved.' };
}

export async function changePassword(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = passwordSchema.safeParse({
    currentPassword: formData.get('currentPassword'),
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
  });

  if (!parsed.success) {
    return {
      fieldErrors: toFieldErrors(parsed.error.issues),
      values: echoValues(formData),
      stamp: Date.now(),
    };
  }

  const { supabase, user } = await requireUser();

  // Supabase does not verify the old password on updateUser, so a stolen
  // session could silently change it. Re-authenticating closes that.
  const { error: reauthError } = await supabase.auth.signInWithPassword({
    email: user.email ?? '',
    password: parsed.data.currentPassword,
  });

  if (reauthError) {
    return { fieldErrors: { currentPassword: 'That is not your current password' } };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });

  if (error) {
    console.error('[password:update]', error.status, error.message);
    return { error: 'We could not change your password. Try again.' };
  }

  return { success: 'Password changed. Other devices stay signed in.' };
}

export async function updateAccount(
  accountId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = accountEditSchema.safeParse({
    name: formData.get('name'),
    broker: formData.get('broker') || null,
    market: formData.get('market'),
    currency: formData.get('currency'),
    startingBalance: formData.get('startingBalance'),
  });

  if (!parsed.success) {
    return {
      fieldErrors: toFieldErrors(parsed.error.issues),
      values: echoValues(formData),
      stamp: Date.now(),
    };
  }

  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from('accounts')
    .update({
      name: parsed.data.name,
      broker: parsed.data.broker,
      market: parsed.data.market,
      currency: parsed.data.currency,
      starting_balance: parsed.data.startingBalance,
    })
    .eq('id', accountId)
    .eq('user_id', user.id);

  if (error) {
    if (error.code === '23505') {
      return { fieldErrors: { name: 'You already have an account with that name' } };
    }
    console.error('[account:update]', error.code, error.message);
    return { error: 'We could not save those changes.' };
  }

  revalidatePath('/settings/accounts');
  revalidatePath('/dashboard');
  redirect('/settings/accounts');
}

/** Archiving hides the account everywhere without touching its trades. */
export async function setAccountArchived(
  accountId: string,
  archived: boolean,
): Promise<void> {
  const { supabase, user } = await requireUser();
  await supabase
    .from('accounts')
    .update({ is_archived: archived })
    .eq('id', accountId)
    .eq('user_id', user.id);

  revalidatePath('/settings/accounts');
  revalidatePath('/dashboard');
  revalidatePath('/journal');
}

export async function deleteAccount(accountId: string): Promise<void> {
  const { supabase, user } = await requireUser();

  // Trades cascade from the account. That is the whole reason this action is
  // behind a typed confirmation in the UI.
  const { error } = await supabase
    .from('accounts')
    .delete()
    .eq('id', accountId)
    .eq('user_id', user.id);

  if (error) console.error('[account:delete]', error.code, error.message);

  revalidatePath('/settings/accounts');
  revalidatePath('/dashboard');
  redirect('/settings/accounts');
}

export async function deleteEverything(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = deleteAccountSchema.safeParse({
    confirmation: formData.get('confirmation'),
  });
  if (!parsed.success) return { error: 'Type your email address to confirm.' };

  const { user } = await requireUser();

  if (parsed.data.confirmation !== (user.email ?? '').toLowerCase()) {
    return { error: 'That does not match your email address.' };
  }

  // Removing the auth user cascades to profiles, and from there to accounts,
  // trades, screenshots and everything else via foreign keys.
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return {
      error:
        'Account deletion is not configured on this server. Add SUPABASE_SERVICE_ROLE_KEY.',
    };
  }

  const { error } = await admin.auth.admin.deleteUser(user.id);

  if (error) {
    console.error('[user:delete]', error.status, error.message);
    return { error: 'We could not delete the account. Contact support.' };
  }

  redirect('/');
}
