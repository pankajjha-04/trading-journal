'use client';

import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import type { AccountSummary } from '@/lib/data/trades';

/**
 * Filters write to the URL and let the server re-query. No client-side state,
 * so a filtered view is bookmarkable and the back button behaves.
 */
export function JournalFilters({
  accounts,
  activeId,
  params,
}: {
  accounts: AccountSummary[];
  activeId: string;
  params: Record<string, string | undefined>;
}) {
  const router = useRouter();

  function update(key: string, value: string) {
    const next = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined) as [string, string][],
    );
    if (value === '' || value === 'all') next.delete(key);
    else next.set(key, value);
    next.set('account', key === 'account' ? value : activeId);
    next.delete('page');
    router.push(`/journal?${next.toString()}`);
  }

  const field =
    'h-9 rounded-md bg-surface-2 px-3 text-xs text-fg ring-1 ring-inset ring-line hover:bg-surface-3 focus:outline-none focus:ring-2 focus:ring-iris-500';

  return (
    <div className="flex flex-wrap gap-2">
      <div className="relative min-w-40 flex-1">
        <label htmlFor="journal-search" className="sr-only">
          Search by symbol
        </label>
        <Search
          aria-hidden
          className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-fg-subtle"
        />
        <input
          id="journal-search"
          type="search"
          placeholder="Search symbol"
          defaultValue={params.q ?? ''}
          onKeyDown={(e) => {
            if (e.key === 'Enter') update('q', e.currentTarget.value.trim());
          }}
          onBlur={(e) => {
            if ((e.currentTarget.value.trim() || '') !== (params.q ?? '')) {
              update('q', e.currentTarget.value.trim());
            }
          }}
          className={`${field} w-full pl-9`}
        />
      </div>

      <label htmlFor="journal-account" className="sr-only">
        Account
      </label>
      <select
        id="journal-account"
        value={activeId}
        onChange={(e) => update('account', e.target.value)}
        className={field}
      >
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </select>

      <label htmlFor="journal-status" className="sr-only">
        Status
      </label>
      <select
        id="journal-status"
        value={params.status ?? 'all'}
        onChange={(e) => update('status', e.target.value)}
        className={field}
      >
        <option value="all">All statuses</option>
        <option value="open">Open</option>
        <option value="closed">Closed</option>
      </select>

      <label htmlFor="journal-direction" className="sr-only">
        Direction
      </label>
      <select
        id="journal-direction"
        value={params.direction ?? 'all'}
        onChange={(e) => update('direction', e.target.value)}
        className={field}
      >
        <option value="all">Both sides</option>
        <option value="long">Long only</option>
        <option value="short">Short only</option>
      </select>
    </div>
  );
}
