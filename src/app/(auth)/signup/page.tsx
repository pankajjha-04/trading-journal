import type { Metadata } from 'next';
import Link from 'next/link';
import { SignupForm } from './signup-form';
import { AuthShell } from '@/components/auth/auth-shell';

export const metadata: Metadata = {
  title: 'Create your account',
  description: 'Start your Ledgerline trading journal — free for your first 50 trades.',
};

export default function SignupPage() {
  return (
    <AuthShell
      title="Start your journal"
      subtitle="Free for your first 50 trades. No card required."
      footer={
        <>
          Already have an account?{' '}
          <Link href="/login" className="font-medium text-iris-400 hover:text-iris-300">
            Log in
          </Link>
        </>
      }
    >
      <SignupForm />
    </AuthShell>
  );
}
