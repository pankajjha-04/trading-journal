import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ResetPasswordForm } from './reset-password-form';
import { AuthShell } from '@/components/auth/auth-shell';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Choose a new password',
  robots: { index: false, follow: false },
};

export default async function ResetPasswordPage() {
  // The recovery link already exchanged its code for a session in the callback.
  // No session here means the link was stale, reused, or opened out of context.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/forgot-password');

  return (
    <AuthShell
      title="Choose a new password"
      subtitle={`Setting a new password for ${user.email}.`}
    >
      <ResetPasswordForm />
    </AuthShell>
  );
}
