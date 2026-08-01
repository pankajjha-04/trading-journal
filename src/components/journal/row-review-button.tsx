'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { Sparkles, X } from 'lucide-react';
import { reviewTrade, type ReviewState } from '@/app/journal/ai-actions';
import { ReviewBody } from './review-body';
import { FormAlert } from '@/components/auth/form-alert';
import { cn } from '@/lib/utils/cn';

/**
 * Reviews a trade in place. A native <dialog> handles Esc, focus and the
 * backdrop without a modal library, and returns focus to the row on close.
 */
export function RowReviewButton({
  tradeId,
  symbol,
  closed,
}: {
  tradeId: string;
  symbol: string;
  closed: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [state, setState] = useState<ReviewState | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    const close = () => setState((s) => s);
    node.addEventListener('close', close);
    return () => node.removeEventListener('close', close);
  }, []);

  function open() {
    dialog.current?.showModal();
    // Cached reviews come back instantly, so nothing is wasted by asking again
    // on every open — the hash lookup happens before any model call.
    startTransition(async () => setState(await reviewTrade(tradeId)));
  }

  return (
    <>
      <button
        type="button"
        onClick={open}
        disabled={!closed}
        title={closed ? `AI review of ${symbol}` : 'Available once the trade is closed'}
        aria-label={`AI review of ${symbol}`}
        className={cn(
          'inline-flex size-7 items-center justify-center rounded-md transition-colors',
          closed
            ? 'text-fg-subtle hover:bg-surface-3 hover:text-iris-400'
            : 'cursor-not-allowed text-fg-subtle/30',
        )}
      >
        <Sparkles aria-hidden className="size-4" />
      </button>

      <dialog
        ref={dialog}
        className={cn(
          // `m-auto` restores the centring a modal dialog gets by default —
          // Tailwind's preflight zeroes the margin on every element, which
          // pins the dialog to the top-left corner instead.
          'm-auto w-[min(34rem,calc(100vw-2rem))] max-h-[85vh] overflow-y-auto',
          'rounded-xl border border-line bg-surface p-0 text-fg shadow-e3',
          'backdrop:bg-black/60 backdrop:backdrop-blur-sm',
        )}
      >
        <div className="sticky top-0 flex items-start justify-between gap-4 border-b border-line bg-surface px-5 py-3.5">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Sparkles aria-hidden className="size-4 text-iris-400" />
              {symbol}
            </h2>
            <p className="mt-0.5 text-xs text-fg-muted">
              Judged on execution, not on whether it won.
            </p>
          </div>
          <button
            type="button"
            onClick={() => dialog.current?.close()}
            aria-label="Close"
            className="flex size-8 shrink-0 items-center justify-center rounded-md text-fg-subtle hover:bg-surface-2 hover:text-fg"
          >
            <X aria-hidden className="size-4" />
          </button>
        </div>

        <div className="px-5 py-5">
          {pending ? (
            <div className="space-y-3" role="status" aria-label="Reviewing">
              <div className="h-3 w-3/4 animate-pulse rounded bg-surface-3" />
              <div className="h-3 w-full animate-pulse rounded bg-surface-3" />
              <div className="h-3 w-2/3 animate-pulse rounded bg-surface-3" />
              <span className="sr-only">Reviewing this trade</span>
            </div>
          ) : state?.error ? (
            <FormAlert tone="error" message={state.error} />
          ) : state?.review ? (
            <ReviewBody review={state.review} cached={state.cached} />
          ) : null}
        </div>
      </dialog>
    </>
  );
}
