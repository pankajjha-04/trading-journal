'use client';

import { useActionState, useState, useTransition } from 'react';
import { Pencil, Plus, Star, Trash2, X } from 'lucide-react';
import {
  deleteStrategy,
  saveStrategy,
  toggleFavourite,
} from '@/app/settings/strategies/actions';
import type { ActionState } from '@/app/(auth)/actions';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { SubmitButton } from '@/components/auth/submit-button';
import { FormAlert } from '@/components/auth/form-alert';
import { cn } from '@/lib/utils/cn';

export interface StrategyRecord {
  id: string;
  name: string;
  description: string | null;
  color: string;
  rules: string[];
  isFavorite: boolean;
  tradeCount: number;
}

const SWATCHES = ['#6e6bf5', '#26c6a0', '#f2545b', '#e5b567', '#4aa8ff', '#a5a3ff'];

function StrategyForm({
  editing,
  onDone,
}: {
  editing: StrategyRecord | null;
  onDone: () => void;
}) {
  const action = saveStrategy.bind(null, editing?.id ?? null);
  const [state, formAction] = useActionState(action, {} as ActionState);
  const [color, setColor] = useState(editing?.color ?? SWATCHES[0]!);
  const keep = state.values ?? {};

  return (
    <form key={state.stamp} action={formAction} className="space-y-4" noValidate>
      {state.error ? <FormAlert tone="error" message={state.error} /> : null}
      {state.success ? <FormAlert tone="success" message={state.success} /> : null}

      <Input
        label="Name"
        name="name"
        placeholder="Liquidity sweep"
        defaultValue={keep.name ?? editing?.name}
        hint="Use the same wording you tag trades with, so the breakdowns line up."
        error={state.fieldErrors?.name}
        required
      />

      <Input
        label="Description"
        name="description"
        placeholder="Sweep of an obvious high, then displacement back inside"
        defaultValue={keep.description ?? editing?.description ?? ''}
        error={state.fieldErrors?.description}
      />

      <Textarea
        label="Rules"
        name="rules"
        rows={5}
        placeholder={'One rule per line\nStop below the sweep wick\nOnly in London or New York'}
        defaultValue={keep.rules ?? editing?.rules.join('\n') ?? ''}
        hint="One per line. These become your pre-trade checklist later."
        error={state.fieldErrors?.rules}
      />

      <div>
        <span className="mb-1.5 block text-xs font-medium text-fg-muted">Colour</span>
        <input type="hidden" name="color" value={color} />
        <div className="flex gap-2">
          {SWATCHES.map((swatch) => (
            <button
              key={swatch}
              type="button"
              onClick={() => setColor(swatch)}
              aria-label={`Use colour ${swatch}`}
              aria-pressed={color === swatch}
              className={cn(
                'size-7 rounded-full ring-2 ring-offset-2 ring-offset-surface transition-transform',
                color === swatch ? 'ring-fg scale-110' : 'ring-transparent hover:scale-105',
              )}
              style={{ backgroundColor: swatch }}
            />
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <SubmitButton>{editing ? 'Save changes' : 'Add strategy'}</SubmitButton>
        <Button variant="ghost" onClick={onDone}>
          {editing ? 'Cancel' : 'Close'}
        </Button>
      </div>
    </form>
  );
}

export function StrategyManager({ strategies }: { strategies: StrategyRecord[] }) {
  const [editing, setEditing] = useState<StrategyRecord | null>(null);
  const [adding, setAdding] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-fg-muted">
          {strategies.length} {strategies.length === 1 ? 'strategy' : 'strategies'}
        </p>
        {!adding && !editing ? (
          <Button size="sm" leadingIcon={<Plus className="size-4" />} onClick={() => setAdding(true)}>
            New strategy
          </Button>
        ) : null}
      </div>

      {adding || editing ? (
        <section className="rounded-xl border border-line bg-surface p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold">
              {editing ? `Edit ${editing.name}` : 'New strategy'}
            </h2>
            <button
              type="button"
              onClick={() => {
                setAdding(false);
                setEditing(null);
              }}
              aria-label="Close"
              className="text-fg-subtle hover:text-fg"
            >
              <X aria-hidden className="size-4" />
            </button>
          </div>
          <StrategyForm
            editing={editing}
            onDone={() => {
              setAdding(false);
              setEditing(null);
            }}
          />
        </section>
      ) : null}

      {strategies.length === 0 && !adding ? (
        <div className="rounded-xl border border-line bg-surface px-5 py-10 text-center">
          <p className="text-sm font-medium">No strategies yet</p>
          <p className="mx-auto mt-1 max-w-sm text-xs text-fg-muted">
            A strategy is a named set of rules. Once you have one, tagging trades
            with it is what makes the breakdown tables worth reading.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {strategies.map((strategy) => (
            <li key={strategy.id} className="rounded-xl border border-line bg-surface p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 gap-3">
                  <span
                    aria-hidden
                    className="mt-1 size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: strategy.color }}
                  />
                  <div className="min-w-0">
                    <h3 className="text-sm font-medium">{strategy.name}</h3>
                    {strategy.description ? (
                      <p className="mt-0.5 text-xs text-fg-muted">{strategy.description}</p>
                    ) : null}
                    <p className="mt-1 text-2xs text-fg-subtle">
                      {strategy.rules.length} {strategy.rules.length === 1 ? 'rule' : 'rules'} ·{' '}
                      {strategy.tradeCount} {strategy.tradeCount === 1 ? 'trade' : 'trades'}
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      startTransition(() =>
                        void toggleFavourite(strategy.id, !strategy.isFavorite),
                      )
                    }
                    disabled={pending}
                    aria-label={strategy.isFavorite ? 'Remove from favourites' : 'Mark as favourite'}
                    aria-pressed={strategy.isFavorite}
                    className={cn(
                      'rounded-md p-1.5 transition-colors',
                      strategy.isFavorite
                        ? 'text-brass'
                        : 'text-fg-subtle hover:bg-surface-3 hover:text-fg',
                    )}
                  >
                    <Star
                      aria-hidden
                      className={cn('size-4', strategy.isFavorite && 'fill-current')}
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAdding(false);
                      setEditing(strategy);
                    }}
                    aria-label={`Edit ${strategy.name}`}
                    className="rounded-md p-1.5 text-fg-subtle transition-colors hover:bg-surface-3 hover:text-fg"
                  >
                    <Pencil aria-hidden className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => startTransition(() => void deleteStrategy(strategy.id))}
                    disabled={pending}
                    aria-label={`Delete ${strategy.name}`}
                    className="rounded-md p-1.5 text-fg-subtle transition-colors hover:bg-surface-3 hover:text-loss"
                  >
                    <Trash2 aria-hidden className="size-4" />
                  </button>
                </div>
              </div>

              {strategy.rules.length > 0 ? (
                <ul className="mt-3 space-y-1 border-t border-line pt-3">
                  {strategy.rules.map((rule, i) => (
                    <li key={i} className="flex gap-2 text-xs text-fg-muted">
                      <span aria-hidden className="mt-1.5 size-1 shrink-0 rounded-full bg-fg-subtle" />
                      {rule}
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
