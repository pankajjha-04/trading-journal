'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { Archive, ArchiveRestore, Pencil, Trash2 } from 'lucide-react';
import { deleteAccount, setAccountArchived } from '@/app/settings/actions';
import { formatCurrency } from '@/lib/utils/format';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';

export function AccountRow({
  id,
  name,
  broker,
  market,
  currency,
  startingBalance,
  archived,
  tradeCount,
}: {
  id: string;
  name: string;
  broker: string | null;
  market: string;
  currency: string;
  startingBalance: number;
  archived: boolean;
  tradeCount: number;
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <li
      className={cn(
        'rounded-xl border border-line bg-surface p-4',
        archived && 'opacity-60',
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-medium">
            {name}
            {archived ? (
              <span className="rounded bg-surface-3 px-1.5 py-0.5 text-2xs text-fg-muted">
                Archived
              </span>
            ) : null}
          </p>
          <p className="mt-0.5 text-xs text-fg-subtle">
            {broker ? `${broker} · ` : ''}
            {market} · {formatCurrency(startingBalance, currency)} start ·{' '}
            {tradeCount} {tradeCount === 1 ? 'trade' : 'trades'}
          </p>
        </div>

        {!confirming ? (
          <div className="flex items-center gap-1">
            <Link href={`/settings/accounts/${id}`}>
              <Button variant="ghost" size="sm" leadingIcon={<Pencil className="size-4" />}>
                Edit
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="sm"
              loading={pending}
              leadingIcon={
                archived ? (
                  <ArchiveRestore className="size-4" />
                ) : (
                  <Archive className="size-4" />
                )
              }
              onClick={() =>
                startTransition(() => void setAccountArchived(id, !archived))
              }
            >
              {archived ? 'Restore' : 'Archive'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              leadingIcon={<Trash2 className="size-4" />}
              onClick={() => setConfirming(true)}
            >
              Delete
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-loss">
              {tradeCount > 0
                ? `Deletes ${tradeCount} ${tradeCount === 1 ? 'trade' : 'trades'} with it.`
                : 'Delete this account?'}
            </span>
            <Button
              variant="danger"
              size="sm"
              loading={pending}
              onClick={() => startTransition(() => void deleteAccount(id))}
            >
              Delete
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
              Keep
            </Button>
          </div>
        )}
      </div>

      {!archived && tradeCount > 0 ? (
        <p className="mt-2 text-2xs text-fg-subtle">
          Archiving hides this account everywhere but keeps its trades.
        </p>
      ) : null}
    </li>
  );
}
