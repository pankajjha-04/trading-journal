'use client';

import dynamic from 'next/dynamic';
import { ChartSkeleton } from '@/components/ui/skeleton';
import type { EquityPoint } from '@/lib/metrics';

// recharts is ~90 kB gzipped. Keeping it behind a dynamic, client-only import
// means it never lands in the shared bundle for the dashboard or journal.
const EquityChart = dynamic(
  () => import('./equity-chart').then((m) => m.EquityChart),
  { ssr: false, loading: () => <ChartSkeleton /> },
);

export function EquityPanel({
  points,
  currency,
  startingBalance,
}: {
  points: EquityPoint[];
  currency: string;
  startingBalance: number;
}) {
  return (
    <section className="rounded-xl border border-line bg-surface p-5">
      <h2 className="text-sm font-semibold">Equity curve</h2>
      <p className="mt-0.5 text-xs text-fg-muted">
        Balance after each closed trade. The dashed line is where you started.
      </p>
      <div className="mt-4">
        <EquityChart
          points={points}
          currency={currency}
          startingBalance={startingBalance}
        />
      </div>
    </section>
  );
}
