'use client';

import { Percent, Scale, TrendingDown, Wallet } from 'lucide-react';
import { StatCard } from '@/components/ui/stat-card';
import { formatCurrency, formatPercent, formatRatio } from '@/lib/utils/format';
import type { PortfolioStats } from '@/lib/metrics';

/**
 * Four numbers, chosen because together they answer "am I actually making
 * money, and how much pain did it cost". Adding more here dilutes the answer —
 * the rest live in Analytics.
 */
export function StatGrid({
  stats,
  currency,
}: {
  stats: PortfolioStats;
  currency: string;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        label="Net P&L"
        value={stats.netPnl}
        format={(v) => formatCurrency(v, currency, { signed: true })}
        tone
        icon={<Wallet className="size-4" />}
        hint={`${stats.closedTrades} closed`}
      />
      <StatCard
        label="Win rate"
        value={stats.winRate}
        format={(v) => formatPercent(v, 1)}
        icon={<Percent className="size-4" />}
        hint={
          stats.scratches > 0
            ? `${stats.wins}W / ${stats.losses}L · ${stats.scratches} scratch`
            : `${stats.wins}W / ${stats.losses}L`
        }
      />
      <StatCard
        label="Profit factor"
        value={stats.profitFactor}
        format={(v) => formatRatio(v, 2)}
        icon={<Scale className="size-4" />}
        hint={stats.profitFactor === null ? 'No losses yet' : 'Gross profit ÷ gross loss'}
      />
      <StatCard
        label="Max drawdown"
        value={stats.maxDrawdown === 0 ? null : -stats.maxDrawdown}
        format={(v) => formatCurrency(v, currency)}
        tone
        icon={<TrendingDown className="size-4" />}
        hint={
          stats.maxDrawdownPct > 0 ? `${formatPercent(stats.maxDrawdownPct, 1)} peak to trough` : undefined
        }
      />
    </div>
  );
}
