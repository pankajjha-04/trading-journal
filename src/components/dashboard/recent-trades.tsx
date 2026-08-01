import Link from 'next/link';
import { computeTradeResult } from '@/lib/metrics';
import { formatCurrency, formatR, pnlTone } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import type { Trade } from '@/lib/types/trade';

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
  });
}

export function RecentTrades({
  trades,
  currency,
}: {
  trades: Trade[];
  currency: string;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface">
      <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
        <h2 className="text-sm font-semibold">Recent trades</h2>
        <Link href="/journal" className="text-xs text-fg-muted hover:text-fg">
          View all
        </Link>
      </div>

      <ul className="divide-y divide-line">
        {trades.map((trade) => {
          const result = computeTradeResult(trade);
          const tone = pnlTone(trade.status === 'closed' ? result.netPnl : null);

          return (
            <li key={trade.id} className="flex items-center gap-4 px-5 py-3 text-sm">
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
                  {trade.direction === 'long' ? 'Long' : 'Short'} ·{' '}
                  {formatWhen(trade.closedAt ?? trade.openedAt)}
                  {trade.setup ? ` · ${trade.setup}` : ''}
                </p>
              </div>

              {trade.status === 'open' ? (
                <span className="rounded-full bg-surface-3 px-2 py-0.5 text-2xs text-fg-muted">
                  Open
                </span>
              ) : (
                <div className="text-right">
                  <p
                    className={cn(
                      'font-mono text-sm font-medium tnum',
                      tone === 'gain' && 'text-gain',
                      tone === 'loss' && 'text-loss',
                      tone === 'flat' && 'text-fg-muted',
                    )}
                  >
                    {formatCurrency(result.netPnl, currency, { signed: true })}
                  </p>
                  {result.rMultiple !== null ? (
                    <p className="font-mono text-2xs text-fg-subtle tnum">
                      {formatR(result.rMultiple)}
                    </p>
                  ) : null}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
