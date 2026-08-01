'use client';

import { useRouter } from 'next/navigation';
import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { AccountSummary } from '@/lib/data/trades';

const PERIODS = [
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
  { value: 'last-month', label: 'Last month' },
  { value: 'quarter', label: 'This quarter' },
  { value: 'year', label: 'This year' },
  { value: 'all', label: 'All time' },
];

export function PeriodPicker({
  accounts,
  activeId,
  period,
}: {
  accounts: AccountSummary[];
  activeId: string;
  period: string;
}) {
  const router = useRouter();

  function go(next: { account?: string; period?: string }) {
    const params = new URLSearchParams({
      account: next.account ?? activeId,
      period: next.period ?? period,
    });
    router.push(`/reports?${params.toString()}`);
  }

  const field =
    'h-9 rounded-md bg-surface-2 px-3 text-xs text-fg ring-1 ring-inset ring-line hover:bg-surface-3 focus:outline-none focus:ring-2 focus:ring-iris-500';

  return (
    <div className="flex flex-wrap items-center gap-2 print:hidden">
      <label htmlFor="report-account" className="sr-only">
        Account
      </label>
      <select
        id="report-account"
        value={activeId}
        onChange={(e) => go({ account: e.target.value })}
        className={field}
      >
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </select>

      <label htmlFor="report-period" className="sr-only">
        Period
      </label>
      <select
        id="report-period"
        value={period}
        onChange={(e) => go({ period: e.target.value })}
        className={field}
      >
        {PERIODS.map((p) => (
          <option key={p.value} value={p.value}>
            {p.label}
          </option>
        ))}
      </select>

      <Button
        variant="outline"
        size="sm"
        leadingIcon={<Printer className="size-4" />}
        onClick={() => window.print()}
      >
        Print
      </Button>
    </div>
  );
}
