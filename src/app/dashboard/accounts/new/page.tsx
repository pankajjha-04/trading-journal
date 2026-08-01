import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { AccountForm } from './account-form';
import { createAccount } from '@/app/dashboard/actions';

export const metadata: Metadata = {
  title: 'New account',
  robots: { index: false, follow: false },
};

export default function NewAccountPage() {
  return (
    <div className="mx-auto max-w-lg">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-xs text-fg-muted hover:text-fg"
      >
        <ArrowLeft aria-hidden className="size-3.5" />
        Back to overview
      </Link>

      <h1 className="mt-6 font-display text-2xl font-semibold">New account</h1>
      <p className="mt-1 text-sm text-fg-muted">
        One account per broker or exchange balance. You can add more later.
      </p>

      <div className="mt-8">
        <AccountForm action={createAccount} />
      </div>
    </div>
  );
}
