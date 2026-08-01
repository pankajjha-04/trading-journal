import type { Metadata } from 'next';
import Link from 'next/link';
import { LoginForm } from './login-form';
import { AuthShell } from '@/components/auth/auth-shell';

export const metadata: Metadata = {
  title: 'Log in',
  description: 'Log in to your Ledgerline trading journal.',
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const safeNext = next?.startsWith('/') ? next : undefined;

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Pick up where your last session left off."
      footer={
        <>
          New here?{' '}
          <Link href="/signup" className="font-medium text-iris-400 hover:text-iris-300">
            Create an account
          </Link>
        </>
      }
    >
      <LoginForm next={safeNext} />
    </AuthShell>
  );
}
