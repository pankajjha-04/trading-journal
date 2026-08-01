'use client';

import { useActionState, useState } from 'react';
import { Plus } from 'lucide-react';
import { createGoal } from '@/app/goals/actions';
import { METRIC_HINTS, METRIC_LABELS, type GoalMetric } from '@/lib/metrics';
import type { ActionState } from '@/app/(auth)/actions';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { SubmitButton } from '@/components/auth/submit-button';
import { FormAlert } from '@/components/auth/form-alert';
import type { AccountSummary } from '@/lib/data/trades';

const METRICS: GoalMetric[] = [
  'net_pnl',
  'win_rate',
  'profit_factor',
  'trade_count',
  'max_risk',
  'discipline',
];

const PERIODS = [
  { value: 'daily', label: 'Each day' },
  { value: 'weekly', label: 'Each week' },
  { value: 'monthly', label: 'Each month' },
  { value: 'yearly', label: 'This year' },
];

/** The unit changes with the metric, so the field says what it wants. */
const UNIT: Record<GoalMetric, string> = {
  net_pnl: 'Amount in your account currency',
  win_rate: 'Percentage, 1 to 100',
  profit_factor: 'A ratio, for example 1.5',
  trade_count: 'Number of trades',
  max_risk: 'Amount you will not lose on one trade',
  discipline: 'Percentage of trades with a stop',
};

export function GoalForm({ accounts }: { accounts: AccountSummary[] }) {
  const [state, formAction] = useActionState(createGoal, {} as ActionState);
  const [metric, setMetric] = useState<GoalMetric>('net_pnl');
  const keep = state.values ?? {};

  return (
    <section className="rounded-xl border border-line bg-surface p-5">
      <h2 className="text-sm font-semibold">Set a goal</h2>
      <p className="mt-0.5 text-xs text-fg-muted">{METRIC_HINTS[metric]}</p>

      <form key={state.stamp} action={formAction} className="mt-4 space-y-4" noValidate>
        {state.error ? <FormAlert tone="error" message={state.error} /> : null}
        {state.success ? <FormAlert tone="success" message={state.success} /> : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Account"
            name="accountId"
            defaultValue={keep.accountId ?? accounts[0]?.id}
            options={accounts.map((a) => ({ value: a.id, label: a.name }))}
            error={state.fieldErrors?.accountId}
          />
          <Select
            label="Measure"
            name="metric"
            value={metric}
            onChange={(e) => setMetric(e.target.value as GoalMetric)}
            options={METRICS.map((m) => ({ value: m, label: METRIC_LABELS[m] }))}
            error={state.fieldErrors?.metric}
          />
          <Select
            label="How often"
            name="period"
            defaultValue={keep.period ?? 'monthly'}
            options={PERIODS}
            error={state.fieldErrors?.period}
          />
          <Input
            label="Target"
            name="target"
            type="number"
            step="any"
            min="0"
            defaultValue={keep.target}
            hint={UNIT[metric]}
            error={state.fieldErrors?.target}
            required
          />
        </div>

        <SubmitButton leadingIcon={<Plus className="size-4" />}>Add goal</SubmitButton>
      </form>
    </section>
  );
}
