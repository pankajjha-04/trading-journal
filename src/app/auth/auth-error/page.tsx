import type { Metadata } from 'next';
import Link from 'next/link';
import { KeyRound } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Link problem',
  robots: { index: false, follow: false },
};

const REASONS: Record<string, { title: string; description: string }> = {
  expired: {
    title: 'That link has expired',
    description:
      'Confirmation and reset links are valid for 24 hours and can be used once. Request a fresh one and it will work.',
  },
  missing: {
    title: 'That link is incomplete',
    description:
      'Some email clients cut long links in half. Try copying the full address from the email into your browser.',
  },
  provider: {
    title: 'Google sign-in did not complete',
    description:
      'The request was cancelled or refused before it finished. You can try again, or use email instead.',
  },
};

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  const copy = REASONS[reason ?? ''] ?? REASONS.expired!;

  return (
    <main id="main" className="flex min-h-dvh items-center justify-center px-6">
      <div className="w-full max-w-md rounded-xl border border-line bg-surface">
        <EmptyState
          icon={<KeyRound className="size-5" />}
          title={copy.title}
          description={copy.description}
          action={
            <Link href="/login">
              <Button>Back to log in</Button>
            </Link>
          }
          secondaryAction={
            <Link href="/forgot-password">
              <Button variant="ghost">Send a new link</Button>
            </Link>
          }
        />
      </div>
    </main>
  );
}
