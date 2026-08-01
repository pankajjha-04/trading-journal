import { formatCurrency, formatPercent } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import type { DaySummary } from '@/lib/metrics';

export interface MonthTotals {
  net: number;
  trades: number;
  green: number;
  red: number;
  best: DaySummary | null;
  worst: DaySummary | null;
  bestStreak: number;
  worstStreak: number;
}

/** Walks the traded days in order to find the longest green and red runs. */
export function summariseMonth(days: DaySummary[]): MonthTotals {
  const ordered = [...days].sort((a, b) => a.date.localeCompare(b.date));

  let net = 0;
  let trades = 0;
  let green = 0;
  let red = 0;
  let best: DaySummary | null = null;
  let worst: DaySummary | null = null;
  let greenRun = 0;
  let redRun = 0;
  let bestStreak = 0;
  let worstStreak = 0;

  for (const day of ordered) {
    net += day.netPnl;
    trades += day.trades;

    if (day.netPnl > 0) {
      green += 1;
      greenRun += 1;
      redRun = 0;
      bestStreak = Math.max(bestStreak, greenRun);
    } else if (day.netPnl < 0) {
      red += 1;
      redRun += 1;
      greenRun = 0;
      worstStreak = Math.max(worstStreak, redRun);
    } else {
      // A flat day breaks both runs — it is neither.
      greenRun = 0;
      redRun = 0;
    }

    if (!best || day.netPnl > best.netPnl) best = day;
    if (!worst || day.netPnl < worst.netPnl) worst = day;
  }

  return { net, trades, green, red, best, worst, bestStreak, worstStreak };
}

function shortDate(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
  });
}

function Tile({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'gain' | 'loss';
}) {
  return (
    <div className="min-w-0">
      <p className="text-2xs tracking-wide text-fg-subtle uppercase">{label}</p>
      <p
        className={cn(
          'mt-1 truncate font-mono text-lg font-semibold tnum',
          tone === 'gain' && 'text-gain',
          tone === 'loss' && 'text-loss',
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-0.5 truncate text-2xs text-fg-subtle">{hint}</p> : null}
    </div>
  );
}

export function MonthSummary({
  totals,
  currency,
}: {
  totals: MonthTotals;
  currency: string;
}) {
  const decided = totals.green + totals.red;
  const greenShare = decided === 0 ? 0 : (totals.green / decided) * 100;

  if (totals.trades === 0) {
    return (
      <div className="rounded-xl border border-line bg-surface px-5 py-4">
        <p className="text-sm text-fg-muted">Nothing closed this month.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-line bg-surface p-5">
      <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-5">
        <Tile
          label="Net this month"
          value={formatCurrency(totals.net, currency, { signed: true })}
          tone={totals.net >= 0 ? 'gain' : 'loss'}
          hint={`${totals.trades} trades`}
        />
        <Tile
          label="Green days"
          value={`${totals.green} / ${decided}`}
          hint={decided === 0 ? undefined : `${formatPercent(greenShare, 0)} of traded days`}
        />
        <Tile
          label="Best day"
          value={totals.best ? formatCurrency(totals.best.netPnl, currency, { signed: true }) : '—'}
          tone={totals.best && totals.best.netPnl > 0 ? 'gain' : undefined}
          hint={totals.best ? shortDate(totals.best.date) : undefined}
        />
        <Tile
          label="Worst day"
          value={totals.worst ? formatCurrency(totals.worst.netPnl, currency, { signed: true }) : '—'}
          tone={totals.worst && totals.worst.netPnl < 0 ? 'loss' : undefined}
          hint={totals.worst ? shortDate(totals.worst.date) : undefined}
        />
        <Tile
          label="Longest run"
          value={`${totals.bestStreak}W / ${totals.worstStreak}L`}
          hint="consecutive days"
        />
      </div>

      {/* One bar, split by how the traded days went. Easier to read at a
          glance than two numbers sitting next to each other. */}
      {decided > 0 ? (
        <div className="mt-5">
          <div className="flex h-2 overflow-hidden rounded-full bg-surface-3">
            <div
              className="bg-gain transition-[width] duration-500"
              style={{ width: `${greenShare}%` }}
            />
            <div
              className="bg-loss transition-[width] duration-500"
              style={{ width: `${100 - greenShare}%` }}
            />
          </div>
          <div className="mt-1.5 flex justify-between text-2xs text-fg-subtle">
            <span>{totals.green} green</span>
            <span>{totals.red} red</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
