import { formatCurrency } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import type { DayCell } from '@/lib/metrics';

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/**
 * A calendar, not a GitHub-style grid: traders think in months, and the shape
 * of a bad week only reads when the weeks line up under each other.
 * Pure CSS grid — no chart library, no client JS.
 */
export function CalendarHeatmap({
  cells,
  currency,
  monthsBack = 3,
}: {
  cells: DayCell[];
  currency: string;
  monthsBack?: number;
}) {
  const byDate = new Map(cells.map((cell) => [cell.date, cell]));
  const peak = Math.max(1, ...cells.map((c) => Math.abs(c.netPnl)));

  const now = new Date();
  const months = Array.from({ length: monthsBack }, (_, i) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (monthsBack - 1 - i), 1);
    return date;
  });

  return (
    <section className="rounded-xl border border-line bg-surface p-5">
      <h2 className="text-sm font-semibold">P&L calendar</h2>
      <p className="mt-0.5 text-xs text-fg-muted">
        Colour depth is scaled to your biggest day. Blank means no trades closed.
      </p>

      <div className="mt-5 grid gap-6 sm:grid-cols-3">
        {months.map((month) => {
          const year = month.getFullYear();
          const monthIndex = month.getMonth();
          const first = new Date(year, monthIndex, 1);
          const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
          // getDay() is Sunday-first; shift so the week starts on Monday.
          const offset = (first.getDay() + 6) % 7;

          return (
            <div key={`${year}-${monthIndex}`}>
              <p className="mb-2 text-xs font-medium text-fg-muted">
                {month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
              </p>

              <div className="grid grid-cols-7 gap-1">
                {DAY_LABELS.map((label, i) => (
                  <span
                    key={i}
                    aria-hidden
                    className="text-center text-2xs text-fg-subtle"
                  >
                    {label}
                  </span>
                ))}

                {Array.from({ length: offset }, (_, i) => (
                  <span key={`pad-${i}`} aria-hidden />
                ))}

                {Array.from({ length: daysInMonth }, (_, i) => {
                  const day = i + 1;
                  const iso = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  const cell = byDate.get(iso);
                  const intensity = cell ? Math.abs(cell.netPnl) / peak : 0;

                  return (
                    <div
                      key={iso}
                      title={
                        cell
                          ? `${iso}: ${formatCurrency(cell.netPnl, currency, { signed: true })} over ${cell.trades} ${cell.trades === 1 ? 'trade' : 'trades'}`
                          : `${iso}: no trades`
                      }
                      className={cn(
                        'aspect-square rounded-[3px] text-center text-2xs leading-[1.6]',
                        cell ? 'text-fg' : 'bg-surface-2 text-fg-subtle',
                      )}
                      style={
                        cell
                          ? {
                              backgroundColor:
                                cell.netPnl >= 0
                                  ? `color-mix(in oklab, var(--color-gain) ${Math.max(18, intensity * 100)}%, var(--color-surface-2))`
                                  : `color-mix(in oklab, var(--color-loss) ${Math.max(18, intensity * 100)}%, var(--color-surface-2))`,
                            }
                          : undefined
                      }
                    >
                      {day}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
