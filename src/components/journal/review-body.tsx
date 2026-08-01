import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import type { TradeReview } from '@/lib/ai/review';

const KIND_META = {
  strength: { icon: CheckCircle2, className: 'text-gain' },
  weakness: { icon: AlertTriangle, className: 'text-loss' },
  note: { icon: Info, className: 'text-fg-subtle' },
} as const;

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-xs text-fg-muted">{label}</span>
        <span className="font-mono text-sm font-semibold tnum">{value}/10</span>
      </div>
      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface-3">
        <div
          className={cn(
            'h-full rounded-full',
            value >= 7 ? 'bg-gain' : value >= 4 ? 'bg-warn' : 'bg-loss',
          )}
          style={{ width: `${value * 10}%` }}
        />
      </div>
    </div>
  );
}

/** Shared by the panel on the edit page and the dialog in the trade table. */
export function ReviewBody({ review, cached }: { review: TradeReview; cached?: boolean }) {
  return (
    <div className="space-y-5">
      <p className="text-sm leading-relaxed">{review.summary}</p>

      {review.findings.length > 0 ? (
        <ul className="space-y-2">
          {review.findings.map((finding, i) => {
            const meta = KIND_META[finding.kind];
            const Icon = meta.icon;
            return (
              <li key={i} className="flex gap-2.5 text-sm text-fg-muted">
                <Icon aria-hidden className={cn('mt-0.5 size-4 shrink-0', meta.className)} />
                {finding.text}
              </li>
            );
          })}
        </ul>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <ScoreBar label="Execution" value={review.scores.execution} />
        <ScoreBar label="Risk" value={review.scores.risk} />
        <ScoreBar label="Discipline" value={review.scores.discipline} />
      </div>

      <p className="text-2xs text-fg-subtle">
        {cached
          ? 'Saved from an earlier review — nothing has changed since.'
          : 'Based on this trade and your history. Not advice.'}
      </p>
    </div>
  );
}
