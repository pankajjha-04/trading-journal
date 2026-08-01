'use client';

import { useState, useTransition } from 'react';
import { Trash2 } from 'lucide-react';
import { deleteTrade } from '@/app/journal/actions';
import { Button } from '@/components/ui/button';

/**
 * Two-step, no modal library. Deleting a trade silently rewrites the equity
 * curve, so it should take one more click than it does to edit one.
 */
export function DeleteTradeButton({
  tradeId,
  symbol,
}: {
  tradeId: string;
  symbol: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <Button
        variant="ghost"
        size="sm"
        leadingIcon={<Trash2 className="size-4" />}
        onClick={() => setConfirming(true)}
      >
        Delete
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-fg-muted">Delete {symbol} permanently?</span>
      <Button
        variant="danger"
        size="sm"
        loading={pending}
        onClick={() => startTransition(() => void deleteTrade(tradeId))}
      >
        Delete
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
        Keep
      </Button>
    </div>
  );
}
