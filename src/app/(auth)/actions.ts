'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { echoValues } from '@/lib/forms/echo';
import { clientKey, rateLimit, resetLimit } from '@/lib/auth/rate-limit';
import {
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  signupSchema,
} from '@/lib/validations/auth';

export interface ActionState {
  error?: string;
  fieldErrors?: Record<string, string>;
  success?: string;
  /**
   * What the user typed, echoed back so a validation error does not empty the
   * form. React 19 resets an uncontrolled form after a server action, so the
   * values have to travel back and the form has to remount with them.
   * Passwords are never included — they should not make a second trip.
   */
  values?: Record<string, string>;
  /** Changes on every response; used as the form's key to force a remount. */
  stamp?: number;
}


async function origin(): Promise<string> {
  const h = await headers();
  return (
    process.env.NEXT_PUBLIC_SITE_URL ??
    `${h.get('x-forwarded-proto') ?? 'http'}://${h.get('host')}`
  );
}

/** Zod issues → one message per field, in the order the form renders them. */
function toFieldErrors(issues: { path: (string | number)[]; message: string }[]) {
  const out: Record<string, string> = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? 'form');
    out[key] ??= issue.message;
  }
  return out;
}

export async function login(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    next: formData.get('next') || undefined,
  });

  if (!parsed.success) {
    return {
      fieldErrors: toFieldErrors(parsed.error.issues),
      values: echoValues(formData),
      stamp: Date.now(),
    };
  }

  const key = clientKey(await headers(), `login:${parsed.data.email}`);
  const limit = rateLimit(key, { limit: 5, windowMs: 60_000, blockMs: 15 * 60_000 });
  if (!limit.allowed) {
    const minutes = Math.ceil(limit.retryAfterSeconds / 60);
    return {
      error: `Too many attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`,
      values: echoValues(formData),
      stamp: Date.now(),
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    // One message for both "no such user" and "wrong password". Distinguishing
    // them turns the login form into an account-enumeration oracle.
    return {
      error: 'That email and password do not match an account.',
      values: echoValues(formData),
      stamp: Date.now(),
    };
  }

  resetLimit(key);
  revalidatePath('/', 'layout');

  // Only same-origin paths: an open redirect here would be a phishing gift.
  const next = parsed.data.next?.startsWith('/') ? parsed.data.next : '/dashboard';
  redirect(next);
}

export async function signup(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = signupSchema.safeParse({
    fullName: formData.get('fullName'),
    email: formData.get('email'),
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

  const limit = rateLimit(clientKey(await headers(), 'signup'), {
    limit: 3,
    windowMs: 10 * 60_000,
    blockMs: 30 * 60_000,
  });
  if (!limit.allowed) {
    return {
      error: 'Too many sign-up attempts from this network. Try again later.',
      values: echoValues(formData),
      stamp: Date.now(),
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
      emailRedirectTo: `${await origin()}/auth/callback?next=/dashboard`,
    },
  });

  if (error) {
    if (error.message.toLowerCase().includes('already registered')) {
      // Same wording as success. An attacker learns nothing; a real owner gets
      // a "someone tried to sign up" email from Supabase.
      return { success: 'Check your email for a confirmation link.' };
    }
    return {
      error: 'We could not create that account. Try again in a moment.',
      values: echoValues(formData),
      stamp: Date.now(),
    };
  }

  // With email confirmation switched off, signUp returns a live session — the
  // user is already logged in, so showing "check your email" would strand them.
  if (data.session) {
    revalidatePath('/', 'layout');
    redirect('/dashboard');
  }

  return { success: 'Check your email for a confirmation link.' };
}

export async function requestPasswordReset(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = forgotPasswordSchema.safeParse({ email: formData.get('email') });
  if (!parsed.success) {
    return { fieldErrors: toFieldErrors(parsed.error.issues) };
  }

  const limit = rateLimit(clientKey(await headers(), 'reset'), {
    limit: 3,
    windowMs: 15 * 60_000,
    blockMs: 30 * 60_000,
  });

  // Even when rate-limited, the response is identical — timing and wording
  // must not reveal whether the address exists.
  if (limit.allowed) {
    const supabase = await createClient();
    await supabase.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo: `${await origin()}/auth/callback?next=/reset-password`,
    });
  }

  return {
    success: 'If an account exists for that address, a reset link is on its way.',
  };
}

export async function resetPassword(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = resetPasswordSchema.safeParse({
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
  });

  if (!parsed.success) {
    return { fieldErrors: toFieldErrors(parsed.error.issues) };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'That reset link has expired. Request a new one.' };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    return { error: 'We could not update your password. Request a new link.' };
  }

  revalidatePath('/', 'layout');
  redirect('/dashboard');
}

export async function signInWithGoogle(next?: string): Promise<ActionState> {
  const supabase = await createClient();
  const target = next?.startsWith('/') ? next : '/dashboard';

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${await origin()}/auth/callback?next=${encodeURIComponent(target)}`,
      queryParams: { access_type: 'offline', prompt: 'consent' },
    },
  });

  if (error || !data.url) {
    return { error: 'Google sign-in is unavailable right now.' };
  }

  redirect(data.url);
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/login');
}
