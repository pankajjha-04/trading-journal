import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getAccounts, getTrade } from '@/lib/data/trades';
import { updateTrade } from '@/app/journal/actions';
import { TradeForm } from '@/components/journal/trade-form';
import { DeleteTradeButton } from '@/components/journal/delete-trade-button';
import { ScreenshotPanel, type StoredShot } from '@/components/journal/screenshot-panel';
import { TradeReview } from '@/components/journal/trade-review';

export const metadata: Metadata = {
  title: 'Edit trade',
  robots: { index: false, follow: false },
};

export default async function EditTradePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [trade, accounts] = await Promise.all([
    getTrade(user.id, id),
    getAccounts(user.id),
  ]);

  // Not found and not yours look identical on purpose — a different message
  // would confirm that some other user's trade id exists.
  if (!trade) notFound();

  const [{ data: shotRows }, { data: strategies }] = await Promise.all([
    supabase
      .from('trade_screenshots')
      .select('id, storage_path, caption')
      .eq('user_id', user.id)
      .eq('trade_id', trade.id)
      .order('created_at', { ascending: true }),
    supabase
      .from('strategies')
      .select('id, name')
      .eq('user_id', user.id)
      .order('is_favorite', { ascending: false })
      .order('name', { ascending: true }),
  ]);

  // The bucket is private, so the browser cannot fetch a path directly. Signed
  // URLs are minted per request and expire in an hour.
  const shots: StoredShot[] = [];
  for (const row of shotRows ?? []) {
    const { data: signed } = await supabase.storage
      .from('screenshots')
      .createSignedUrl(row.storage_path, 3600);
    if (signed?.signedUrl) {
      shots.push({ id: row.id, url: signed.signedUrl, caption: row.caption });
    }
  }

  const action = updateTrade.bind(null, trade.id);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-center justify-between gap-4">
        <Link
          href="/journal"
          className="inline-flex items-center gap-1.5 text-xs text-fg-muted hover:text-fg"
        >
          <ArrowLeft aria-hidden className="size-3.5" />
          Back to journal
        </Link>
        <DeleteTradeButton tradeId={trade.id} symbol={trade.symbol} />
      </div>

      <h1 className="mt-6 font-display text-2xl font-semibold">Edit {trade.symbol}</h1>
      <p className="mt-1 text-sm text-fg-muted">
        Corrections recompute every metric that depends on this trade.
      </p>

      <div className="mt-8">
        <TradeReview tradeId={trade.id} closed={trade.status === 'closed'} />
      </div>

      <div className="mt-6">
        <ScreenshotPanel tradeId={trade.id} shots={shots} />
      </div>

      <div className="mt-6">
        <TradeForm
          accounts={accounts}
          strategies={strategies ?? []}
          action={action}
          trade={trade}
          submitLabel="Save changes"
        />
      </div>
    </div>
  );
}
