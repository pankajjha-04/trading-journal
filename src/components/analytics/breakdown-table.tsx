import { AlertCircle } from 'lucide-react';
import { formatCurrency, formatPercent, formatRatio } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import type { BreakdownRow } from '@/lib/metrics';

/**
 * The bar behind each row is scaled to the largest absolute P&L in the table,
 * so a glance ranks the groups before you read a single number.
 */
export function BreakdownTable({
  title,
  description,
  rows,
  currency,
}: {
  title: string;
  description: string;
  rows: BreakdownRow[];
  currency: string;
}) {
  const peak = Math.max(1, ...rows.map((r) => Math.abs(r.stats.netPnl)));

  return (
    <section className="overflow-hidden rounded-xl border border-line bg-surface">
      <header className="border-b border-line px-5 py-3.5">
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="mt-0.5 text-xs text-fg-muted">{description}</p>
      </header>

      {rows.length === 0 ? (
        <p className="px-5 py-8 text-center text-xs text-fg-subtle">
          Nothing to group yet — this fills in as you log trades.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-fg-muted">
                <th scope="col" className="px-5 py-2.5 font-medium">Group</th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">Trades</th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">Win rate</th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">Avg R</th>
                <th scope="col" className="px-5 py-2.5 text-right font-medium">Net P&L</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((row) => {
                const positive = row.stats.netPnl > 0;
                const width = (Math.abs(row.stats.netPnl) / peak) * 100;

                return (
                  <tr key={row.key} className="relative">
                    <td className="relative px-5 py-3">
                      <span
                        aria-hidden
                        className={cn(
                          'absolute inset-y-1 left-0 rounded-r-sm opacity-[0.13]',
                          positive ? 'bg-gain' : 'bg-loss',
                        )}
                        style={{ width: `${width}%` }}
                      />
                      <span className="relative flex items-center gap-1.5">
                        {row.label}
                        {!row.reliable ? (
                          <AlertCircle
                            aria-label="Too few trades to be meaningful"
                            className="size-3 text-fg-subtle"
                          />
                        ) : null}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-fg-muted tnum">
                      {row.stats.closedTrades}
                    </td>
                    <td className="px-3 py-3 text-right font-mono tnum">
                      {formatPercent(row.stats.winRate, 0)}
                    </td>
                    <td className="px-3 py-3 text-right font-mono tnum">
                      {row.stats.expectancyR === null
                        ? '—'
                        : `${formatRatio(row.stats.expectancyR)}R`}
                    </td>
                    <td
                      className={cn(
                        'px-5 py-3 text-right font-mono font-medium tnum',
                        positive && 'text-gain',
                        row.stats.netPnl < 0 && 'text-loss',
                      )}
                    >
                      {formatCurrency(row.stats.netPnl, currency, { signed: true })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {rows.some((r) => !r.reliable) ? (
        <p className="border-t border-line px-5 py-2.5 text-2xs text-fg-subtle">
          Rows marked with an icon have fewer than 10 trades — the numbers move
          too much on one result to act on yet.
        </p>
      ) : null}
    </section>
  );
}
