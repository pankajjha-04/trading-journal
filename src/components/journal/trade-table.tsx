import Link from 'next/link';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { computeTradeResult } from '@/lib/metrics';
import { RowReviewButton } from './row-review-button';
import { formatCurrency, formatR, pnlTone } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import type { Trade } from '@/lib/types/trade';

type SortKey = 'opened_at' | 'symbol' | 'net_pnl' | 'r_multiple';

const COLUMNS: { key: SortKey | null; label: string; align?: 'right' }[] = [
  { key: 'opened_at', label: 'Date' },
  { key: 'symbol', label: 'Symbol' },
  { key: null, label: 'Side' },
  { key: null, label: 'Entry', align: 'right' },
  { key: null, label: 'Exit', align: 'right' },
  { key: 'r_multiple', label: 'R', align: 'right' },
  { key: 'net_pnl', label: 'Net P&L', align: 'right' },
];

function SortLink({
  column,
  label,
  current,
  order,
  query,
}: {
  column: SortKey;
  label: string;
  current: string;
  order: string;
  query: URLSearchParams;
}) {
  const active = current === column;
  const next = new URLSearchParams(query);
  next.set('sort', column);
  next.set('order', active && order === 'desc' ? 'asc' : 'desc');

  return (
    <Link
      href={`/journal?${next.toString()}`}
      className={cn(
        'inline-flex items-center gap-1 hover:text-fg',
        active ? 'text-fg' : 'text-fg-muted',
      )}
      aria-sort={active ? (order === 'asc' ? 'ascending' : 'descending') : undefined}
    >
      {label}
      {active ? (
        order === 'asc' ? (
          <ArrowUp aria-hidden className="size-3" />
        ) : (
          <ArrowDown aria-hidden className="size-3" />
        )
      ) : null}
    </Link>
  );
}

export function TradeTable({
  trades,
  currency,
  sort,
  order,
  query,
}: {
  trades: Trade[];
  currency: string;
  sort: string;
  order: string;
  query: URLSearchParams;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-surface">
      <table className="w-full min-w-[720px] text-sm">
        <caption className="sr-only">Your logged trades</caption>
        <thead>
          <tr className="border-b border-line text-left text-xs">
            {COLUMNS.map((column) => (
              <th
                key={column.label}
                scope="col"
                className={cn(
                  'px-4 py-2.5 font-medium text-fg-muted',
                  column.align === 'right' && 'text-right',
                )}
              >
                {column.key ? (
                  <SortLink
                    column={column.key}
                    label={column.label}
                    current={sort}
                    order={order}
                    query={query}
                  />
                ) : (
                  column.label
                )}
              </th>
            ))}
            <th scope="col" className="px-4 py-2.5" />
          </tr>
        </thead>

        <tbody className="divide-y divide-line">
          {trades.map((trade) => {
            const result = computeTradeResult(trade);
            const closed = trade.status === 'closed';
            const tone = pnlTone(closed ? result.netPnl : null);

            return (
              <tr key={trade.id} className="transition-colors hover:bg-surface-2">
                <td className="px-4 py-3 whitespace-nowrap text-fg-muted tnum">
                  {new Date(trade.closedAt ?? trade.openedAt).toLocaleDateString(undefined, {
                    day: '2-digit',
                    month: 'short',
                    year: '2-digit',
                  })}
                </td>
                <td className="px-4 py-3 font-medium">
                  {trade.symbol}
                  {trade.setup ? (
                    <span className="ml-2 text-2xs text-fg-subtle">{trade.setup}</span>
                  ) : null}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      'rounded px-1.5 py-0.5 text-2xs font-medium',
                      trade.direction === 'long'
                        ? 'bg-gain-soft text-gain'
                        : 'bg-loss-soft text-loss',
                    )}
                  >
                    {trade.direction === 'long' ? 'Long' : 'Short'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-mono tnum">{trade.entryPrice}</td>
                <td className="px-4 py-3 text-right font-mono text-fg-muted tnum">
                  {closed ? trade.exitPrice : 'Open'}
                </td>
                <td className="px-4 py-3 text-right font-mono tnum">
                  {closed ? formatR(result.rMultiple) : '—'}
                </td>
                <td
                  className={cn(
                    'px-4 py-3 text-right font-mono font-medium tnum',
                    tone === 'gain' && 'text-gain',
                    tone === 'loss' && 'text-loss',
                    tone === 'flat' && 'text-fg-muted',
                  )}
                >
                  {closed ? formatCurrency(result.netPnl, currency, { signed: true }) : '—'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <RowReviewButton
                      tradeId={trade.id}
                      symbol={trade.symbol}
                      closed={closed}
                    />
                    <Link
                      href={`/journal/${trade.id}/edit`}
                      className="rounded-md px-2 py-1 text-xs text-fg-muted hover:bg-surface-3 hover:text-fg"
                    >
                      Edit
                    </Link>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
