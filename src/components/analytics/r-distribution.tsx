import { cn } from '@/lib/utils/cn';
import type { DistributionBucket } from '@/lib/metrics';

/**
 * Where your results actually land. A healthy curve is skewed right: many
 * small losses clustered near −1R, a thin tail of large winners.
 * Rendered as divs — a bar chart library for eight bars is not worth 90 kB.
 */
export function RDistribution({ buckets }: { buckets: DistributionBucket[] }) {
  const peak = Math.max(1, ...buckets.map((b) => b.count));
  const total = buckets.reduce((sum, b) => sum + b.count, 0);

  return (
    <section className="rounded-xl border border-line bg-surface p-5">
      <h2 className="text-sm font-semibold">Result distribution</h2>
      <p className="mt-0.5 text-xs text-fg-muted">
        {total === 0
          ? 'Needs trades with a stop recorded — R cannot be computed without one.'
          : `${total} ${total === 1 ? 'trade' : 'trades'} with a stop recorded.`}
      </p>

      <div className="mt-5 flex h-40 items-end gap-1.5">
        {buckets.map((bucket) => (
          <div key={bucket.label} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
            <span className="font-mono text-2xs text-fg-subtle tnum">
              {bucket.count > 0 ? bucket.count : ''}
            </span>
            <div
              title={`${bucket.label}: ${bucket.count}`}
              className={cn(
                'w-full rounded-t-sm transition-[height] duration-500',
                bucket.from < 0 ? 'bg-loss/60' : 'bg-gain/60',
              )}
              style={{
                height:
                  bucket.count > 0 ? `${Math.max(4, (bucket.count / peak) * 100)}%` : '2px',
              }}
            />
          </div>
        ))}
      </div>

      <div className="mt-2 flex gap-1.5">
        {buckets.map((bucket) => (
          <span
            key={bucket.label}
            className="flex-1 text-center text-2xs text-fg-subtle"
            aria-hidden
          >
            {bucket.from < 0 ? bucket.from : `+${bucket.from}`}
          </span>
        ))}
      </div>
    </section>
  );
}
