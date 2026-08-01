import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CalendarDays, ChevronLeft, ChevronRight, Wallet } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getAccounts, getTrades } from '@/lib/data/trades';
import { computeTradeResult, summariseDays, tradesOnDay } from '@/lib/metrics';
import { MonthGrid } from '@/components/calendar/month-grid';
import { MonthSummary, summariseMonth } from '@/components/calendar/month-summary';
import { AccountSwitcher } from '@/components/dashboard/account-switcher';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatR, pnlTone } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';

export const metadata: Metadata = {
  title: 'Calendar',
  robots: { index: false, follow: false },
};

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ account?: string; month?: string; day?: string }>;
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
          description="The calendar shows the days you traded, so there has to be an account to read."
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
  const trades = await getTrades(user.id, active.id);
  const days = summariseDays(trades);

  // Month comes from the URL as YYYY-MM; anything unparseable falls back to now.
  const match = params.month?.match(/^(\d{4})-(\d{2})$/);
  const now = new Date();
  const year = match ? Number(match[1]) : now.getFullYear();
  const month = match ? Number(match[2]) - 1 : now.getMonth();
  const cursor = new Date(year, month, 1);

  const query = new URLSearchParams({ account: active.id });
  const monthKey = (offset: number) => {
    const target = new Date(year, month + offset, 1);
    const next = new URLSearchParams(query);
    next.set('month', `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}`);
    return `/calendar?${next.toString()}`;
  };
  query.set('month', `${year}-${String(month + 1).padStart(2, '0')}`);

  const selected = params.day ?? null;
  const dayTrades = selected ? tradesOnDay(trades, selected) : [];
  const daySummary = selected ? days.get(selected) : undefined;

  const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;
  const totals = summariseMonth(
    [...days.values()].filter((day) => day.date.startsWith(monthPrefix)),
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold">Calendar</h1>
          <p className="mt-1 text-sm text-fg-muted">
            Every day you closed a trade, and what it came to.
          </p>
        </div>
        <div className="w-48">
          <AccountSwitcher accounts={accounts} activeId={active.id} />
        </div>
      </div>

      <MonthSummary totals={totals} currency={active.currency} />

      <div className="rounded-xl border border-line bg-surface p-5">
        <div className="mb-5 flex items-center justify-between gap-3">
          <Link href={monthKey(-1)} aria-label="Previous month">
            <Button variant="ghost" size="icon">
              <ChevronLeft aria-hidden className="size-4" />
            </Button>
          </Link>
          <h2 className="font-display text-lg font-semibold">
            {cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
          </h2>
          <Link href={monthKey(1)} aria-label="Next month">
            <Button variant="ghost" size="icon">
              <ChevronRight aria-hidden className="size-4" />
            </Button>
          </Link>
        </div>

        <MonthGrid
          year={year}
          month={month}
          days={days}
          currency={active.currency}
          selected={selected}
          query={query}
        />
      </div>

      {selected ? (
        <section className="overflow-hidden rounded-xl border border-line bg-surface">
          <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-line px-5 py-3.5">
            <h2 className="text-sm font-semibold">
              {new Date(`${selected}T12:00:00`).toLocaleDateString(undefined, {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </h2>
            {daySummary ? (
              <p className="font-mono text-sm tnum">
                <span className={daySummary.netPnl >= 0 ? 'text-gain' : 'text-loss'}>
                  {formatCurrency(daySummary.netPnl, active.currency, { signed: true })}
                </span>
                <span className="ml-2 text-xs text-fg-subtle">
                  {daySummary.wins}W / {daySummary.losses}L
                </span>
              </p>
            ) : null}
          </div>

          {dayTrades.length === 0 ? (
            <p className="px-5 py-8 text-center text-xs text-fg-subtle">
              Nothing closed on this day.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {dayTrades.map((trade) => {
                const result = computeTradeResult(trade);
                const tone = pnlTone(result.netPnl);

                return (
                  <li key={trade.id}>
                    <Link
                      href={`/journal/${trade.id}/edit`}
                      className="flex items-center gap-4 px-5 py-3 text-sm transition-colors hover:bg-surface-2"
                    >
                      <span
                        aria-hidden
                        className={cn(
                          'size-1.5 shrink-0 rounded-full',
                          trade.direction === 'long' ? 'bg-gain' : 'bg-loss',
                        )}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{trade.symbol}</p>
                        <p className="text-xs text-fg-subtle">
                          {trade.direction === 'long' ? 'Long' : 'Short'}
                          {trade.setup ? ` · ${trade.setup}` : ''}
                          {trade.session ? ` · ${trade.session}` : ''}
                        </p>
                      </div>
                      <div className="text-right">
                        <p
                          className={cn(
                            'font-mono text-sm font-medium tnum',
                            tone === 'gain' && 'text-gain',
                            tone === 'loss' && 'text-loss',
                            tone === 'flat' && 'text-fg-muted',
                          )}
                        >
                          {formatCurrency(result.netPnl, active.currency, { signed: true })}
                        </p>
                        {result.rMultiple !== null ? (
                          <p className="font-mono text-2xs text-fg-subtle tnum">
                            {formatR(result.rMultiple)}
                          </p>
                        ) : null}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ) : (
        <p className="flex items-center gap-2 text-xs text-fg-subtle">
          <CalendarDays aria-hidden className="size-3.5" />
          Pick a day to see the trades that closed on it.
        </p>
      )}
    </div>
  );
}
