'use client';

import { useState, useTransition } from 'react';
import { Sparkles } from 'lucide-react';
import { reviewTrade, type ReviewState } from '@/app/journal/ai-actions';
import { Button } from '@/components/ui/button';
import { FormAlert } from '@/components/auth/form-alert';
import { ReviewBody } from './review-body';

export function TradeReview({ tradeId, closed }: { tradeId: string; closed: boolean }) {
  const [state, setState] = useState<ReviewState | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <section className="rounded-xl border border-line bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles aria-hidden className="size-4 text-iris-400" />
            AI review
          </h2>
          <p className="mt-0.5 max-w-md text-xs text-fg-muted">
            Reads this trade against your own record with the same setup, and
            comments on how it was executed — not on whether it won.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          loading={pending}
          disabled={!closed}
          onClick={() =>
            startTransition(async () => setState(await reviewTrade(tradeId)))
          }
        >
          {state?.review ? 'Review again' : 'Review this trade'}
        </Button>
      </div>

      {!closed ? (
        <p className="mt-4 text-xs text-fg-subtle">
          Available once the trade is closed.
        </p>
      ) : null}

      {state?.error ? <div className="mt-4"><FormAlert tone="error" message={state.error} /></div> : null}

      {state?.review ? (
        <div className="mt-5">
          <ReviewBody review={state.review} cached={state.cached} />
        </div>
      ) : null}

    </section>
  );
}
