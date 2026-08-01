import type { CSSProperties } from 'react';
import { cn } from '@/lib/utils/cn';

/**
 * Skeletons mirror the shape of the content they replace, so the layout does
 * not shift when data lands. A generic grey box is worse than a spinner.
 */
export function Skeleton({
  className,
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      aria-hidden
      style={style}
      className={cn(
        'animate-pulse rounded-md bg-surface-3 motion-reduce:animate-none',
        className,
      )}
    />
  );
}

export function StatCardSkeleton() {
  return (
    <div className="rounded-xl border border-line bg-surface p-5">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-3 h-8 w-32" />
      <Skeleton className="mt-3 h-3 w-20" />
    </div>
  );
}

export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="divide-y divide-line" role="status" aria-label="Loading trades">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4 px-5 py-3.5">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-14" />
          <Skeleton className="h-4 flex-1 max-w-32" />
          <Skeleton className="ml-auto h-4 w-24" />
        </div>
      ))}
      <span className="sr-only">Loading trades</span>
    </div>
  );
}

export function ChartSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('flex h-64 items-end gap-1.5 px-5 pb-5', className)} aria-hidden>
      {[38, 52, 44, 66, 58, 74, 62, 81, 70, 88, 79, 94].map((h, i) => (
        <Skeleton key={i} className="flex-1 rounded-sm" style={{ height: `${h}%` }} />
      ))}
    </div>
  );
}
