import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, Wallet } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getAccounts } from '@/lib/data/trades';
import { createTrade } from '@/app/journal/actions';
import { TradeForm } from '@/components/journal/trade-form';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'New trade',
  robots: { index: false, follow: false },
};

export default async function NewTradePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const accounts = await getAccounts(user.id);
  const { data: strategies } = await supabase
    .from('strategies')
    .select('id, name')
    .eq('user_id', user.id)
    .order('is_favorite', { ascending: false })
    .order('name', { ascending: true });

  if (accounts.length === 0) {
    return (
      <div className="mx-auto max-w-2xl rounded-xl border border-line bg-surface">
        <EmptyState
          icon={<Wallet className="size-5" />}
          title="You need an account first"
          description="Every trade belongs to one broker or exchange balance, so create that before logging trades."
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
    <div className="mx-auto max-w-3xl">
      <Link
        href="/journal"
        className="inline-flex items-center gap-1.5 text-xs text-fg-muted hover:text-fg"
      >
        <ArrowLeft aria-hidden className="size-3.5" />
        Back to journal
      </Link>

      <h1 className="mt-6 font-display text-2xl font-semibold">Log a trade</h1>
      <p className="mt-1 text-sm text-fg-muted">
        Only symbol, quantity and entry are required. Everything else makes the
        analytics sharper later.
      </p>

      <div className="mt-8">
        <TradeForm
          accounts={accounts}
          strategies={strategies ?? []}
          action={createTrade}
          submitLabel="Save trade"
        />
      </div>
    </div>
  );
}
