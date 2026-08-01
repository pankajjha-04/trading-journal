import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { LineChart, Plus, Wallet } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getAccounts, getTrades } from '@/lib/data/trades';
import { computePortfolioStats, computeRiskRatios } from '@/lib/metrics';
import { StatGrid } from '@/components/dashboard/stat-grid';
import { RecentTrades } from '@/components/dashboard/recent-trades';
import { AccountSwitcher } from '@/components/dashboard/account-switcher';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatRatio } from '@/lib/utils/format';

export const metadata: Metadata = {
  title: 'Overview',
  robots: { index: false, follow: false },
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ account?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { account: requestedAccount } = await searchParams;
  const accounts = await getAccounts(user.id);

  if (accounts.length === 0) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="rounded-xl border border-line bg-surface">
          <EmptyState
            icon={<Wallet className="size-5" />}
            title="Create your first account"
            description="An account is one broker or exchange balance. Every trade you log belongs to one, so your equity curve and drawdown stay honest."
            action={
              <Link href="/dashboard/accounts/new">
                <Button leadingIcon={<Plus className="size-4" />}>Create an account</Button>
              </Link>
            }
          />
        </div>
      </div>
    );
  }

  // An account id from the URL is only honoured if the user actually owns it —
  // otherwise anyone could probe other people's accounts by editing the query.
  const active =
    accounts.find((a) => a.id === requestedAccount) ?? accounts[0]!;

  const trades = await getTrades(user.id, active.id);
  const stats = computePortfolioStats(trades, active.startingBalance);
  const ratios = computeRiskRatios(trades, active.startingBalance);
  const balance = active.startingBalance + stats.netPnl;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold">Overview</h1>
          <p className="mt-1 text-sm text-fg-muted">
            Balance{' '}
            <span className="font-mono text-fg tnum">
              {formatCurrency(balance, active.currency)}
            </span>
            {active.broker ? ` · ${active.broker}` : ''}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-48">
            <AccountSwitcher accounts={accounts} activeId={active.id} />
          </div>
          <Link href="/journal/new">
            <Button leadingIcon={<Plus className="size-4" />}>Add trade</Button>
          </Link>
        </div>
      </div>

      <StatGrid stats={stats} currency={active.currency} />

      {trades.length === 0 ? (
        <div className="rounded-xl border border-line bg-surface">
          <EmptyState
            icon={<LineChart className="size-5" />}
            title="No trades in this account yet"
            description="Log one trade and the numbers above start filling in. Import from your broker later — nothing here has to be typed twice."
            action={
              <Link href="/journal/new">
                <Button leadingIcon={<Plus className="size-4" />}>Add your first trade</Button>
              </Link>
            }
          />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <RecentTrades trades={trades.slice(0, 8)} currency={active.currency} />

          <div className="rounded-xl border border-line bg-surface">
            <div className="border-b border-line px-5 py-3.5">
              <h2 className="text-sm font-semibold">Risk-adjusted</h2>
              <p className="mt-0.5 text-xs text-fg-muted">
                {ratios.sampleSize < 20
                  ? `Needs 20 trading days — ${ratios.sampleSize} so far`
                  : `Across ${ratios.sampleSize} trading days`}
              </p>
            </div>
            <dl className="divide-y divide-line">
              {[
                ['Sharpe', formatRatio(ratios.sharpe)],
                ['Sortino', formatRatio(ratios.sortino)],
                ['Calmar', formatRatio(ratios.calmar)],
                ['Expectancy', formatCurrency(stats.expectancy, active.currency, { signed: true })],
                ['Avg R', stats.expectancyR === null ? '—' : `${formatRatio(stats.expectancyR)}R`],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between px-5 py-2.5">
                  <dt className="text-xs text-fg-muted">{label}</dt>
                  <dd className="font-mono text-sm tnum">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      )}
    </div>
  );
}
