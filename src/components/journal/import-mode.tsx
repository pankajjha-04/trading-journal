'use client';

import { useState } from 'react';
import { ImportWizard } from './import-wizard';
import { OrderWizard } from './order-wizard';
import { cn } from '@/lib/utils/cn';
import type { AccountSummary } from '@/lib/data/trades';

const MODES = [
  {
    id: 'trades' as const,
    title: 'One row per trade',
    body: 'Each row already has an entry and an exit. Most crypto exchange exports look like this.',
  },
  {
    id: 'orders' as const,
    title: 'One row per order',
    body: 'Entries, exits and cancelled stops are separate rows. Common with forex and CFD brokers.',
  },
];

/**
 * Asking up front is better than guessing. The two file shapes need different
 * handling, and getting it wrong silently produces trades that look plausible
 * and are wrong — the worst possible outcome for a journal.
 */
export function ImportMode({ accounts }: { accounts: AccountSummary[] }) {
  const [mode, setMode] = useState<'trades' | 'orders'>('trades');

  return (
    <div className="space-y-5">
      <fieldset>
        <legend className="text-sm font-semibold">What does your file look like?</legend>
        <p className="mt-0.5 text-xs text-fg-muted">
          Open it and look at the first few rows. If you see the same trade twice
          — once to open, once to close — pick the second option.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {MODES.map((option) => (
            <label
              key={option.id}
              className={cn(
                'cursor-pointer rounded-xl border p-4 transition-colors',
                mode === option.id
                  ? 'border-iris-500/50 bg-surface-2'
                  : 'border-line bg-surface hover:border-line-strong',
              )}
            >
              <div className="flex items-start gap-3">
                <input
                  type="radio"
                  name="import-mode"
                  value={option.id}
                  checked={mode === option.id}
                  onChange={() => setMode(option.id)}
                  className="mt-0.5 size-4 accent-iris-500"
                />
                <div>
                  <p className="text-sm font-medium">{option.title}</p>
                  <p className="mt-1 text-xs text-fg-muted">{option.body}</p>
                </div>
              </div>
            </label>
          ))}
        </div>
      </fieldset>

      {mode === 'trades' ? (
        <ImportWizard accounts={accounts} />
      ) : (
        <OrderWizard accounts={accounts} />
      )}
    </div>
  );
}
