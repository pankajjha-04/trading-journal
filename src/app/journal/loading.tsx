import { Skeleton, TableSkeleton } from '@/components/ui/skeleton';

export default function JournalLoading() {
  return (
    <div className="mx-auto max-w-6xl space-y-5" role="status" aria-label="Loading journal">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-9 w-full max-w-md" />
      <div className="rounded-xl border border-line bg-surface">
        <TableSkeleton rows={10} />
      </div>
      <span className="sr-only">Loading journal</span>
    </div>
  );
}
