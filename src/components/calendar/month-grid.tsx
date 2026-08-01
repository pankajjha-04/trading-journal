import Link from 'next/link';
import { formatCurrency } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import type { DaySummary } from '@/lib/metrics';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/**
 * A month at a time, weeks aligned under each other. The shape of a bad week
 * only reads when Monday sits above Monday.
 */
export function MonthGrid({
  year,
  month,
  days,
  currency,
  selected,
  query,
}: {
  year: number;
  month: number;
  days: Map<string, DaySummary>;
  currency: string;
  selected: string | null;
  query: URLSearchParams;
}) {
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const offset = (first.getDay() + 6) % 7;

  const peak = Math.max(
    1,
    ...[...days.values()].map((day) => Math.abs(day.netPnl)),
  );

  const href = (date: string) => {
    const next = new URLSearchParams(query);
    next.set('day', date);
    return `/calendar?${next.toString()}`;
  };

  return (
    <div>
      <div className="grid grid-cols-7 gap-1.5">
        {WEEKDAYS.map((label) => (
          <span
            key={label}
            aria-hidden
            className="pb-1 text-center text-2xs tracking-wide text-fg-subtle uppercase"
          >
            {label}
          </span>
        ))}

        {Array.from({ length: offset }, (_, i) => (
          <span key={`pad-${i}`} aria-hidden />
        ))}

        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1;
          const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const summary = days.get(date);
          const intensity = summary ? Math.abs(summary.netPnl) / peak : 0;
          const isSelected = selected === date;

          const cell = (
            <>
              <span className="font-mono text-xs tnum">{day}</span>
              {summary ? (
                <>
                  <span
                    className={cn(
                      'mt-auto font-mono text-2xs font-medium tnum',
                      summary.netPnl >= 0 ? 'text-gain' : 'text-loss',
                    )}
                  >
                    {formatCurrency(summary.netPnl, currency, {
                      compact: true,
                      signed: true,
                    })}
                  </span>
                  <span className="text-2xs text-fg-subtle">
                    {summary.trades} {summary.trades === 1 ? 'trade' : 'trades'}
                  </span>
                </>
              ) : null}
            </>
          );

          const shared = cn(
            'flex aspect-square flex-col rounded-md border p-1.5 text-left transition-colors',
            isSelected ? 'border-iris-500' : 'border-line',
            !summary && 'bg-surface-2 text-fg-subtle',
          );

          if (!summary) {
            return (
              <div key={date} className={shared}>
                {cell}
              </div>
            );
          }

          return (
            <Link
              key={date}
              href={href(date)}
              aria-current={isSelected ? 'date' : undefined}
              className={cn(shared, 'hover:border-line-strong')}
              style={{
                backgroundColor:
                  summary.netPnl >= 0
                    ? `color-mix(in oklab, var(--color-gain) ${Math.max(14, intensity * 70)}%, var(--color-surface))`
                    : `color-mix(in oklab, var(--color-loss) ${Math.max(14, intensity * 70)}%, var(--color-surface))`,
              }}
            >
              {cell}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
