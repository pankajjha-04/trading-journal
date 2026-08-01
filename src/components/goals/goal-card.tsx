'use client';

import { useTransition } from 'react';
import { Check, Trash2 } from 'lucide-react';
import { deleteGoal } from '@/app/goals/actions';
import { METRIC_LABELS, type GoalMetric, type GoalPeriod, type GoalProgress } from '@/lib/metrics';
import { formatCurrency, formatPercent, formatRatio } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';

const PERIOD_LABELS: Record<GoalPeriod, string> = {
  daily: 'today',
  weekly: 'this week',
  monthly: 'this month',
  yearly: 'this year',
};

function display(metric: GoalMetric, value: number | null, currency: string): string {
  if (value === null) return '—';
  switch (metric) {
    case 'net_pnl':
      return formatCurrency(value, currency, { signed: true });
    case 'max_risk':
      return formatCurrency(value, currency);
    case 'win_rate':
    case 'discipline':
      return formatPercent(value, 0);
    case 'profit_factor':
      return formatRatio(value, 2);
    case 'trade_count':
    default:
      return String(Math.round(value));
  }
}

export function GoalCard({
  id,
  metric,
  period,
  accountName,
  currency,
  progress,
}: {
  id: string;
  metric: GoalMetric;
  period: GoalPeriod;
  accountName: string;
  currency: string;
  progress: GoalProgress;
}) {
  const [pending, startTransition] = useTransition();
  const percent = progress.ratio === null ? 0 : Math.round(progress.ratio * 100);

  return (
    <li className="rounded-xl border border-line bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-sm font-medium">
            {METRIC_LABELS[metric]}
            {progress.met ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-gain-soft px-1.5 py-0.5 text-2xs font-medium text-gain">
                <Check aria-hidden className="size-3" />
                met
              </span>
            ) : null}
          </h3>
          <p className="mt-0.5 text-xs text-fg-subtle">
            {accountName} · {PERIOD_LABELS[period]} ·{' '}
            {progress.lowerIsBetter ? 'stay under' : 'reach'}{' '}
            {display(metric, progress.target, currency)}
          </p>
        </div>

        <button
          type="button"
          onClick={() => startTransition(() => void deleteGoal(id))}
          disabled={pending}
          aria-label="Delete goal"
          className="shrink-0 rounded-md p-1.5 text-fg-subtle transition-colors hover:bg-surface-3 hover:text-loss disabled:opacity-50"
        >
          <Trash2 aria-hidden className="size-4" />
        </button>
      </div>

      <div className="mt-4 flex items-baseline justify-between gap-2">
        <span
          className={cn(
            'font-mono text-lg font-semibold tnum',
            progress.met ? 'text-gain' : progress.current === null ? 'text-fg-muted' : 'text-fg',
          )}
        >
          {display(metric, progress.current, currency)}
        </span>
        <span className="text-2xs text-fg-subtle">
          {progress.sampleSize === 0
            ? 'nothing closed yet'
            : `${progress.sampleSize} ${progress.sampleSize === 1 ? 'trade' : 'trades'}`}
        </span>
      </div>

      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-3">
        <div
          className={cn(
            'h-full rounded-full transition-[width] duration-500',
            progress.met ? 'bg-gain' : progress.lowerIsBetter ? 'bg-warn' : 'bg-iris-500',
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
    </li>
  );
}
