'use client';

import { useActionState, useMemo, useState } from 'react';
import Link from 'next/link';
import { computeTradeResult } from '@/lib/metrics';
import type { Trade } from '@/lib/types/trade';
import type { ActionState } from '@/app/(auth)/actions';
import type { AccountSummary } from '@/lib/data/trades';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { SubmitButton } from '@/components/auth/submit-button';
import { FormAlert } from '@/components/auth/form-alert';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatR, formatRatio } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';

const MARKETS = ['crypto', 'forex', 'futures', 'stocks', 'options', 'indices'];
const SESSIONS = ['asia', 'london', 'newyork', 'overlap', 'other'];
const EMOTIONS = [
  'calm', 'confident', 'fearful', 'greedy', 'revenge', 'fomo', 'impatient', 'bored',
];

const options = (values: string[], includeBlank?: string) => [
  ...(includeBlank ? [{ value: '', label: includeBlank }] : []),
  ...values.map((v) => ({ value: v, label: v.charAt(0).toUpperCase() + v.slice(1) })),
];

/** ISO instant → the local "YYYY-MM-DDTHH:mm" that datetime-local expects. */
function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-line bg-surface p-5">
      <h2 className="text-sm font-semibold">{title}</h2>
      {description ? <p className="mt-0.5 text-xs text-fg-muted">{description}</p> : null}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

export function TradeForm({
  accounts,
  strategies = [],
  action,
  trade,
  submitLabel,
}: {
  accounts: AccountSummary[];
  strategies?: { id: string; name: string }[];
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  trade?: Trade;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState(action, {} as ActionState);

  // On a validation error the server sends back what was typed. Without this
  // a single bad field would empty all twenty-four of them.
  const keep = state.values ?? {};
  const kept = (name: string, fallback?: string | number | null) =>
    keep[name] ?? (fallback ?? undefined);

  const [status, setStatus] = useState(
    (state.values?.status as Trade['status']) ?? trade?.status ?? 'open',
  );
  const [direction, setDirection] = useState(
    (state.values?.direction as Trade['direction']) ?? trade?.direction ?? 'long',
  );
  const [accountId, setAccountId] = useState(
    state.values?.accountId ?? trade?.accountId ?? accounts[0]?.id ?? '',
  );

  // Live numbers, computed by the same function the database and dashboard
  // use. A preview that disagrees with the saved result is worse than none.
  const [prices, setPrices] = useState({
    quantity: trade?.quantity ?? 0,
    contractSize: trade?.contractSize ?? 1,
    entryPrice: trade?.entryPrice ?? 0,
    exitPrice: trade?.exitPrice ?? 0,
    stopLoss: trade?.stopLoss ?? 0,
    takeProfit: trade?.takeProfit ?? 0,
    costs: (trade?.fees ?? 0) + (trade?.commission ?? 0) + (trade?.swap ?? 0),
  });

  const currency =
    accounts.find((a) => a.id === accountId)?.currency ?? accounts[0]?.currency ?? 'USD';

  const preview = useMemo(() => {
    if (!prices.entryPrice || !prices.quantity) return null;
    return computeTradeResult({
      id: 'preview',
      accountId,
      symbol: 'PREVIEW',
      market: 'crypto',
      direction,
      status: status === 'closed' ? 'closed' : 'open',
      openedAt: new Date().toISOString(),
      closedAt: null,
      quantity: prices.quantity,
      contractSize: prices.contractSize || 1,
      entryPrice: prices.entryPrice,
      exitPrice: status === 'closed' && prices.exitPrice ? prices.exitPrice : null,
      stopLoss: prices.stopLoss || null,
      takeProfit: prices.takeProfit || null,
      fees: prices.costs,
      commission: 0,
      swap: 0,
      strategyId: null,
      setup: null,
      timeframe: null,
      session: null,
      marketCondition: null,
      emotion: null,
      confidence: null,
      executionRating: null,
      notes: null,
      tags: [],
    });
  }, [prices, direction, status, accountId]);

  const track = (key: keyof typeof prices) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setPrices((p) => ({ ...p, [key]: Number(e.target.value) || 0 }));

  return (
    <form key={state.stamp} action={formAction} className="space-y-5" noValidate>
      {state.error ? <FormAlert tone="error" message={state.error} /> : null}

      <Section title="Position" description="What you traded and how much.">
        <Select
          label="Account"
          name="accountId"
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          options={accounts.map((a) => ({ value: a.id, label: a.name }))}
          error={state.fieldErrors?.accountId}
        />
        <Input
          label="Symbol"
          name="symbol"
          placeholder="BTCUSDT"
          defaultValue={kept('symbol', trade?.symbol)}
          error={state.fieldErrors?.symbol}
          required
        />
        <Select
          label="Market"
          name="market"
          defaultValue={kept('market', trade?.market ?? 'crypto')}
          options={options(MARKETS)}
          error={state.fieldErrors?.market}
        />
        <Select
          label="Direction"
          name="direction"
          value={direction}
          onChange={(e) => setDirection(e.target.value as 'long' | 'short')}
          options={[
            { value: 'long', label: 'Long' },
            { value: 'short', label: 'Short' },
          ]}
        />
        <Input
          label="Quantity"
          name="quantity"
          type="number"
          step="any"
          min="0"
          placeholder="0.5"
          defaultValue={kept('quantity', trade?.quantity)}
          onChange={track('quantity')}
          error={state.fieldErrors?.quantity}
          required
        />
        <Input
          label="Contract size"
          name="contractSize"
          type="number"
          step="any"
          min="0"
          defaultValue={kept('contractSize', trade?.contractSize ?? 1)}
          onChange={track('contractSize')}
          hint="1 for crypto and stocks. 100,000 for a standard forex lot."
          error={state.fieldErrors?.contractSize}
        />
      </Section>

      <Section title="Timing">
        <Select
          label="Status"
          name="status"
          value={status}
          onChange={(e) => setStatus(e.target.value as Trade['status'])}
          options={[
            { value: 'open', label: 'Open' },
            { value: 'closed', label: 'Closed' },
          ]}
        />
        <div className="hidden sm:block" />
        <Input
          label="Opened at"
          name="openedAt"
          type="datetime-local"
          defaultValue={keep.openedAt ?? toLocalInput(trade?.openedAt ?? new Date().toISOString())}
          error={state.fieldErrors?.openedAt}
          required
        />
        {status === 'closed' ? (
          <Input
            label="Closed at"
            name="closedAt"
            type="datetime-local"
            defaultValue={keep.closedAt ?? toLocalInput(trade?.closedAt ?? null)}
            error={state.fieldErrors?.closedAt}
            required
          />
        ) : null}
      </Section>

      <Section title="Prices" description="Stop and target are optional, but without a stop there is no R.">
        <Input
          label="Entry price"
          name="entryPrice"
          type="number"
          step="any"
          min="0"
          defaultValue={kept('entryPrice', trade?.entryPrice)}
          onChange={track('entryPrice')}
          error={state.fieldErrors?.entryPrice}
          required
        />
        {status === 'closed' ? (
          <Input
            label="Exit price"
            name="exitPrice"
            type="number"
            step="any"
            min="0"
            defaultValue={kept('exitPrice', trade?.exitPrice)}
            onChange={track('exitPrice')}
            error={state.fieldErrors?.exitPrice}
            required
          />
        ) : (
          <div className="hidden sm:block" />
        )}
        <Input
          label="Stop loss"
          name="stopLoss"
          type="number"
          step="any"
          min="0"
          defaultValue={kept('stopLoss', trade?.stopLoss)}
          onChange={track('stopLoss')}
          error={state.fieldErrors?.stopLoss}
        />
        <Input
          label="Take profit"
          name="takeProfit"
          type="number"
          step="any"
          min="0"
          defaultValue={kept('takeProfit', trade?.takeProfit)}
          onChange={track('takeProfit')}
          error={state.fieldErrors?.takeProfit}
        />
      </Section>

      {preview ? (
        <div className="rounded-xl border border-line bg-surface-2 p-5">
          <h2 className="text-sm font-semibold">Live check</h2>
          <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              ['Risk', preview.riskAmount === null ? '—' : formatCurrency(preview.riskAmount, currency)],
              ['Planned R:R', preview.plannedRr === null ? '—' : `${formatRatio(preview.plannedRr)}:1`],
              [
                'Net P&L',
                status === 'closed' ? formatCurrency(preview.netPnl, currency, { signed: true }) : '—',
              ],
              ['Result', status === 'closed' ? formatR(preview.rMultiple) : '—'],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-2xs tracking-wide text-fg-subtle uppercase">{label}</dt>
                <dd
                  className={cn(
                    'mt-1 font-mono text-sm font-semibold tnum',
                    label === 'Net P&L' && status === 'closed' && preview.netPnl > 0 && 'text-gain',
                    label === 'Net P&L' && status === 'closed' && preview.netPnl < 0 && 'text-loss',
                  )}
                >
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}

      <Section title="Costs">
        <Input
          label="Fees"
          name="fees"
          type="number"
          step="any"
          min="0"
          defaultValue={kept('fees', trade?.fees ?? 0)}
          onChange={(e) =>
            setPrices((p) => ({ ...p, costs: Number(e.target.value) || 0 }))
          }
          error={state.fieldErrors?.fees}
        />
        <Input
          label="Commission"
          name="commission"
          type="number"
          step="any"
          min="0"
          defaultValue={kept('commission', trade?.commission ?? 0)}
          error={state.fieldErrors?.commission}
        />
        <Input
          label="Swap or funding"
          name="swap"
          type="number"
          step="any"
          defaultValue={kept('swap', trade?.swap ?? 0)}
          hint="Negative if it cost you."
          error={state.fieldErrors?.swap}
        />
      </Section>

      <Section title="Context" description="This is what makes the analytics worth reading later.">
        {strategies.length > 0 ? (
          <Select
            label="Strategy"
            name="strategyId"
            defaultValue={kept('strategyId', trade?.strategyId ?? '')}
            options={[
              { value: '', label: 'Not linked' },
              ...strategies.map((s) => ({ value: s.id, label: s.name })),
            ]}
            hint="Links this trade to a named set of rules."
            error={state.fieldErrors?.strategyId}
          />
        ) : null}

        <Input
          label="Setup"
          name="setup"
          placeholder="Order block retest"
          defaultValue={kept('setup', trade?.setup)}
          error={state.fieldErrors?.setup}
        />
        <Input
          label="Timeframe"
          name="timeframe"
          placeholder="15m"
          defaultValue={kept('timeframe', trade?.timeframe)}
          error={state.fieldErrors?.timeframe}
        />
        <Select
          label="Session"
          name="session"
          defaultValue={kept('session', trade?.session ?? '')}
          options={options(SESSIONS, 'Not recorded')}
          error={state.fieldErrors?.session}
        />
        <Input
          label="Market condition"
          name="marketCondition"
          placeholder="Trending, ranging, news"
          defaultValue={kept('marketCondition', trade?.marketCondition)}
        />
        <Input
          label="Tags"
          name="tags"
          placeholder="smc, liquidity-sweep"
          defaultValue={kept('tags', trade?.tags.join(', '))}
          hint="Comma separated."
          error={state.fieldErrors?.tags}
        />
      </Section>

      <Section title="Review" description="Rate the execution, not the outcome.">
        <Select
          label="Emotion"
          name="emotion"
          defaultValue={kept('emotion', trade?.emotion ?? '')}
          options={options(EMOTIONS, 'Not recorded')}
          error={state.fieldErrors?.emotion}
        />
        <div className="hidden sm:block" />
        <Input
          label="Confidence (1-10)"
          name="confidence"
          type="number"
          min="1"
          max="10"
          defaultValue={kept('confidence', trade?.confidence)}
          error={state.fieldErrors?.confidence}
        />
        <Input
          label="Execution rating (1-10)"
          name="executionRating"
          type="number"
          min="1"
          max="10"
          defaultValue={kept('executionRating', trade?.executionRating)}
          hint="Did you follow your plan? A loss can still be a 10."
          error={state.fieldErrors?.executionRating}
        />
        <div className="sm:col-span-2">
          <Textarea
            label="Notes"
            name="notes"
            rows={5}
            placeholder="What did you see, what did you do, what would you change?"
            defaultValue={kept('notes', trade?.notes)}
            error={state.fieldErrors?.notes}
          />
        </div>
      </Section>

      <div className="flex items-center gap-3">
        <SubmitButton size="lg">{submitLabel}</SubmitButton>
        <Link href="/journal">
          <Button variant="ghost" size="lg">
            Cancel
          </Button>
        </Link>
      </div>
    </form>
  );
}
