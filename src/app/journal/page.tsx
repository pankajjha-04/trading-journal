import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { BookOpen, Plus, Upload, Wallet } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getAccounts, queryTrades, type TradeQuery } from '@/lib/data/trades';
import { TradeTable } from '@/components/journal/trade-table';
import { JournalFilters } from '@/components/journal/journal-filters';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Journal',
  robots: { index: false, follow: false },
};

const PER_PAGE = 25;
const SORTS = ['opened_at', 'closed_at', 'symbol', 'net_pnl', 'r_multiple'];

export default async function JournalPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const params = await searchParams;
  const accounts = await getAccounts(user.id);

  if (accounts.length === 0) {
    return (
      <div className="mx-auto max-w-2xl rounded-xl border border-line bg-surface">
        <EmptyState
          icon={<Wallet className="size-5" />}
          title="You need an account first"
          description="Every trade belongs to one broker or exchange balance."
          action={
            <Link href="/dashboard/accounts/new">
              <Button>Create an account</Button>
            </Link>
          }
        />
      </div>
    );
  }

  const active = accounts.find((a) => a.id === params.account) ?? accounts[0]!;

  // Whitelist the sort column. It is interpolated into the query, so an
  // arbitrary string from the URL must never reach the database.
  const sort = SORTS.includes(params.sort ?? '')
    ? (params.sort as TradeQuery['sort'])
    : 'opened_at';
  const order = params.order === 'asc' ? 'asc' : 'desc';
  const page = Math.max(1, Number(params.page) || 1);

  const { trades, total } = await queryTrades(user.id, {
    accountId: active.id,
    status: (params.status as TradeQuery['status']) ?? 'all',
    direction: (params.direction as TradeQuery['direction']) ?? 'all',
    search: params.q?.slice(0, 32),
    sort,
    order,
    page,
    perPage: PER_PAGE,
  });

  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const query = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined) as [string, string][],
  );
  query.set('account', active.id);

  const filtered =
    Boolean(params.q) ||
    (params.status && params.status !== 'all') ||
    (params.direction && params.direction !== 'all');

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold">Journal</h1>
          <p className="mt-1 text-sm text-fg-muted">
            {total} {total === 1 ? 'trade' : 'trades'} in {active.name}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/journal/import">
            <Button variant="outline" leadingIcon={<Upload className="size-4" />}>
              Import
            </Button>
          </Link>
          <Link href="/journal/new">
            <Button leadingIcon={<Plus className="size-4" />}>Add trade</Button>
          </Link>
        </div>
      </div>

      <JournalFilters accounts={accounts} activeId={active.id} params={params} />

      {trades.length === 0 ? (
        <div className="rounded-xl border border-line bg-surface">
          {filtered ? (
            <EmptyState
              icon={<BookOpen className="size-5" />}
              title="No trades match those filters"
              description="Try widening the date, side, or symbol filters to see more."
              action={
                <Link href={`/journal?account=${active.id}`}>
                  <Button variant="secondary">Clear filters</Button>
                </Link>
              }
            />
          ) : (
            <EmptyState
              icon={<BookOpen className="size-5" />}
              title="Nothing logged yet"
              description="Log one trade and your win rate, expectancy and drawdown start computing straight away."
              action={
                <Link href="/journal/new">
                  <Button leadingIcon={<Plus className="size-4" />}>Add your first trade</Button>
                </Link>
              }
            />
          )}
        </div>
      ) : (
        <>
          <TradeTable
            trades={trades}
            currency={active.currency}
            sort={sort ?? 'opened_at'}
            order={order}
            query={query}
          />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-fg-subtle">
              {total === 0
                ? 'No trades'
                : `Showing ${(page - 1) * PER_PAGE + 1}–${Math.min(page * PER_PAGE, total)} of ${total}`}
            </p>
            <Pagination
              page={page}
              totalPages={pages}
              basePath="/journal"
              query={query}
              label="Trade pages"
            />
          </div>
        </>
      )}
    </div>
  );
}
