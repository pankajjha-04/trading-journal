import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { BarChart3, Wallet } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getAccounts, getTrades } from '@/lib/data/trades';
import {
  breakdownBy,
  buildEquityCurve,
  computePortfolioStats,
  dailyPnl,
  rDistribution,
} from '@/lib/metrics';
import { EquityPanel } from '@/components/analytics/equity-panel';
import { CalendarHeatmap } from '@/components/analytics/calendar-heatmap';
import { RDistribution } from '@/components/analytics/r-distribution';
import { BreakdownTable } from '@/components/analytics/breakdown-table';
import { AccountSwitcher } from '@/components/dashboard/account-switcher';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatPercent, formatRatio } from '@/lib/utils/format';

export const metadata: Metadata = {
  title: 'Analytics',
  robots: { index: false, follow: false },
};

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ account?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { account: requested } = await searchParams;
  const accounts = await getAccounts(user.id);

  if (accounts.length === 0) {
    return (
      <div className="mx-auto max-w-2xl rounded-xl border border-line bg-surface">
        <EmptyState
          icon={<Wallet className="size-5" />}
          title="You need an account first"
          description="Analytics are computed per account, so create one before there is anything to analyse."
          action={
            <Link href="/dashboard/accounts/new">
              <Button>Create an account</Button>
            </Link>
          }
        />
      </div>
    );
  }

  const active = accounts.find((a) => a.id === requested) ?? accounts[0]!;
  const trades = await getTrades(user.id, active.id);
  const stats = computePortfolioStats(trades, active.startingBalance);

  if (stats.closedTrades === 0) {
    return (
      <div className="mx-auto max-w-2xl rounded-xl border border-line bg-surface">
        <EmptyState
          icon={<BarChart3 className="size-5" />}
          title="No closed trades to analyse"
          description="Analytics need finished trades. Close one, or log a past trade you have already exited."
          action={
            <Link href="/journal/new">
              <Button>Log a trade</Button>
            </Link>
          }
        />
      </div>
    );
  }

  const curve = buildEquityCurve(trades, active.startingBalance);
  const currency = active.currency;

  const summary = [
    ['Average winner', formatCurrency(stats.avgWin, currency)],
    ['Average loser', formatCurrency(stats.avgLoss, currency)],
    ['Largest win', formatCurrency(stats.largestWin, currency)],
    ['Largest loss', formatCurrency(stats.largestLoss, currency)],
    ['Best streak', `${stats.maxConsecutiveWins} wins`],
    ['Worst streak', `${stats.maxConsecutiveLosses} losses`],
    ['Recovery factor', formatRatio(stats.recoveryFactor)],
    ['Total costs', formatCurrency(stats.totalCosts, currency)],
  ] as const;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold">Analytics</h1>
          <p className="mt-1 text-sm text-fg-muted">
            {stats.closedTrades} closed trades · win rate{' '}
            {formatPercent(stats.winRate, 1)} · net{' '}
            {formatCurrency(stats.netPnl, currency, { signed: true })}
          </p>
        </div>
        <div className="w-48">
          <AccountSwitcher accounts={accounts} activeId={active.id} />
        </div>
      </div>

      <EquityPanel
        points={curve}
        currency={currency}
        startingBalance={active.startingBalance}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <RDistribution buckets={rDistribution(trades)} />

        <section className="rounded-xl border border-line bg-surface p-5">
          <h2 className="text-sm font-semibold">The rest of the numbers</h2>
          <p className="mt-0.5 text-xs text-fg-muted">
            Everything the overview leaves out on purpose.
          </p>
          <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3">
            {summary.map(([label, value]) => (
              <div key={label} className="flex items-baseline justify-between gap-2">
                <dt className="text-xs text-fg-muted">{label}</dt>
                <dd className="font-mono text-sm tnum">{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>

      <CalendarHeatmap cells={dailyPnl(trades)} currency={currency} />

      <div className="grid gap-6 lg:grid-cols-2">
        <BreakdownTable
          title="By setup"
          description="Which patterns actually pay, once costs are taken out."
          rows={breakdownBy(trades, 'setup', active.startingBalance)}
          currency={currency}
        />
        <BreakdownTable
          title="By session"
          description="Asia, London, New York, or the overlap."
          rows={breakdownBy(trades, 'session', active.startingBalance)}
          currency={currency}
        />
        <BreakdownTable
          title="By day of week"
          description="Some days are quietly expensive."
          rows={breakdownBy(trades, 'weekday', active.startingBalance)}
          currency={currency}
        />
        <BreakdownTable
          title="By emotion"
          description="What you felt going in, against what came out."
          rows={breakdownBy(trades, 'emotion', active.startingBalance)}
          currency={currency}
        />
        <BreakdownTable
          title="By symbol"
          description="Concentration is not the same as edge."
          rows={breakdownBy(trades, 'symbol', active.startingBalance)}
          currency={currency}
        />
        <BreakdownTable
          title="By direction"
          description="A long-only edge in a rising market is not an edge."
          rows={breakdownBy(trades, 'direction', active.startingBalance)}
          currency={currency}
        />
        <BreakdownTable
          title="By timeframe"
          description="Where your reads hold up."
          rows={breakdownBy(trades, 'timeframe', active.startingBalance)}
          currency={currency}
        />
        <BreakdownTable
          title="By confidence"
          description="If your 9s do not beat your 5s, the rating is noise."
          rows={breakdownBy(trades, 'confidence', active.startingBalance)}
          currency={currency}
        />
      </div>
    </div>
  );
}
