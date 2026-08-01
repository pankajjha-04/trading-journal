import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, Wallet } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getAccounts } from '@/lib/data/trades';
import { ImportMode } from '@/components/journal/import-mode';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Import trades',
  robots: { index: false, follow: false },
};

export default async function ImportPage() {
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
          description="Imported trades have to land somewhere, so create an account before uploading."
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
      <Link
        href="/journal"
        className="inline-flex items-center gap-1.5 text-xs text-fg-muted hover:text-fg"
      >
        <ArrowLeft aria-hidden className="size-3.5" />
        Back to journal
      </Link>

      <h1 className="mt-6 font-display text-2xl font-semibold">Import trades</h1>
      <p className="mt-1 max-w-2xl text-sm text-fg-muted">
        Works with exports from Binance, Bybit, OKX, MT4, MT5 and most brokers,
        whether they export finished trades or raw orders. The file is read in
        your browser — nothing is uploaded until you confirm.
      </p>

      <div className="mt-8">
        <ImportMode accounts={accounts} />
      </div>
    </div>
  );
}
