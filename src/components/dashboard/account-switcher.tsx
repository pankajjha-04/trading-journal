'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Wallet } from 'lucide-react';
import type { AccountSummary } from '@/lib/data/trades';

const NEW_ACCOUNT = '__new__';

/**
 * The selected account lives in the URL, not in React state: it survives a
 * refresh, it can be shared, and every server component on the page reads the
 * same value without a context provider.
 */
export function AccountSwitcher({
  accounts,
  activeId,
}: {
  accounts: AccountSummary[];
  activeId: string;
}) {
  const router = useRouter();
  const params = useSearchParams();

  if (accounts.length === 0) return null;

  function select(id: string) {
    // Creating an account belongs in this menu — it is where you already are
    // when you notice you need another one.
    if (id === NEW_ACCOUNT) {
      router.push('/dashboard/accounts/new');
      return;
    }
    const next = new URLSearchParams(params.toString());
    next.set('account', id);
    // Relative, so switching accounts keeps you on the page you are reading.
    router.push(`?${next.toString()}`);
  }

  return (
    <div className="relative">
      <label htmlFor="account-switcher" className="sr-only">
        Active account
      </label>
      <Wallet
        aria-hidden
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle"
      />
      <select
        id="account-switcher"
        value={activeId}
        onChange={(e) => select(e.target.value)}
        className="h-9 w-full appearance-none rounded-md bg-surface-2 pl-9 pr-3 text-xs text-fg ring-1 ring-inset ring-line hover:bg-surface-3 focus:outline-none focus:ring-2 focus:ring-iris-500"
      >
        {accounts.map((account) => (
          <option key={account.id} value={account.id}>
            {account.name}
          </option>
        ))}
        <option disabled>──────────</option>
        <option value={NEW_ACCOUNT}>+ New account</option>
      </select>
    </div>
  );
}
