import { ChartSkeleton, Skeleton } from '@/components/ui/skeleton';

export default function AnalyticsLoading() {
  return (
    <div className="mx-auto max-w-6xl space-y-6" role="status" aria-label="Loading analytics">
      <Skeleton className="h-8 w-44" />
      <div className="rounded-xl border border-line bg-surface pt-5">
        <Skeleton className="mx-5 h-4 w-32" />
        <ChartSkeleton className="mt-4" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-56 rounded-xl" />
        ))}
      </div>
      <span className="sr-only">Loading analytics</span>
    </div>
  );
}
