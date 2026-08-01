import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Download, FileJson, FileSpreadsheet, Wallet } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getAccounts, getTrades } from '@/lib/data/trades';
import {
  breakdownBy,
  computePortfolioStats,
  dailyPnl,
  resolvePeriod,
  tradesInPeriod,
} from '@/lib/metrics';
import { ReportView } from '@/components/reports/report-view';
import { PeriodPicker } from '@/components/reports/period-picker';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Reports',
  robots: { index: false, follow: false },
};

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ account?: string; period?: string }>;
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
          description="Reports are produced per account."
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
  const periodKey = params.period ?? 'month';
  const period = resolvePeriod(periodKey);

  const allTrades = await getTrades(user.id, active.id);
  const trades = tradesInPeriod(allTrades, period);

  // Baseline is the balance as it stood when the period opened, so drawdown
  // inside the report is measured against the equity the trader actually had.
  const before = allTrades.filter(
    (t) => t.status === 'closed' && t.closedAt && t.closedAt < period.from,
  );
  const openingBalance =
    active.startingBalance + computePortfolioStats(before, active.startingBalance).netPnl;

  const stats = computePortfolioStats(trades, openingBalance);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 print:hidden">
        <div>
          <h1 className="font-display text-2xl font-semibold">Reports</h1>
          <p className="mt-1 text-sm text-fg-muted">
            Print a period summary, or take your data with you.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <a href={`/api/export/trades?account=${active.id}`} download>
            <Button variant="outline" size="sm" leadingIcon={<Download className="size-4" />}>
              Trades CSV
            </Button>
          </a>
          <a href={`/api/export/xlsx?account=${active.id}`} download>
            <Button
              variant="outline"
              size="sm"
              leadingIcon={<FileSpreadsheet className="size-4" />}
            >
              Excel
            </Button>
          </a>
          <a href="/api/export/backup" download>
            <Button variant="ghost" size="sm" leadingIcon={<FileJson className="size-4" />}>
              Full backup
            </Button>
          </a>
        </div>
      </div>

      <PeriodPicker
        accounts={accounts}
        activeId={active.id}
        period={periodKey}
      />

      <ReportView
        accountName={active.name}
        broker={active.broker}
        currency={active.currency}
        period={period}
        stats={stats}
        openingBalance={openingBalance}
        days={dailyPnl(trades)}
        setups={breakdownBy(trades, 'setup', openingBalance)}
        sessions={breakdownBy(trades, 'session', openingBalance)}
      />
    </div>
  );
}
