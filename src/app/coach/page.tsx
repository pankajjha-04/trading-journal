import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Wallet } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getAccounts } from '@/lib/data/trades';
import { CoachPanel } from '@/components/coach/coach-panel';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'AI coach',
  robots: { index: false, follow: false },
};

export default async function CoachPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const accounts = await getAccounts(user.id);

  if (accounts.length === 0) {
    return (
      <div className="mx-auto max-w-2xl rounded-xl border border-line bg-surface">
        <EmptyState
          icon={<Wallet className="size-5" />}
          title="You need an account first"
          description="The coach reads your logged trades, so there has to be something to read."
          action={
            <Link href="/dashboard/accounts/new">
              <Button>Create an account</Button>
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <CoachPanel accounts={accounts} />
    </div>
  );
}
