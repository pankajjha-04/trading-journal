'use client';

import { useActionState, useState } from 'react';
import type { ActionState } from '@/app/(auth)/actions';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { SubmitButton } from '@/components/auth/submit-button';
import { FormAlert } from '@/components/auth/form-alert';

const INITIAL: ActionState = {};

const MARKETS = [
  { value: 'crypto', label: 'Crypto' },
  { value: 'forex', label: 'Forex' },
  { value: 'futures', label: 'Futures' },
  { value: 'stocks', label: 'Stocks' },
  { value: 'options', label: 'Options' },
  { value: 'indices', label: 'Indices' },
];

const CURRENCIES = ['USD', 'INR', 'EUR', 'GBP', 'AED', 'SGD', 'JPY'].map((c) => ({
  value: c,
  label: c,
}));

/** What a position of 1 unit means, phrased per market rather than as a number. */
const CONTRACT_HINT: Record<string, string> = {
  crypto: 'Quantity is in coins or contracts — 0.5 BTC is 0.5.',
  forex: 'Quantity is in lots. One standard lot is 100,000 units.',
  futures: 'Quantity is in contracts. Multipliers are set per trade.',
  stocks: 'Quantity is in shares.',
  options: 'Quantity is in contracts.',
  indices: 'Quantity is in contracts or units.',
};

export interface AccountDefaults {
  name: string;
  broker: string | null;
  market: string;
  currency: string;
  startingBalance: number;
}

export function AccountForm({
  action,
  defaults,
  submitLabel = 'Create account',
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  defaults?: AccountDefaults;
  submitLabel?: string;
}) {
  const [state, formAction] = useActionState(action, INITIAL);
  const keep = state.values ?? {};
  const [market, setMarket] = useState(defaults?.market ?? 'crypto');

  return (
    <form key={state.stamp} action={formAction} className="space-y-4" noValidate>
      {state.error ? <FormAlert tone="error" message={state.error} /> : null}

      <Input
        label="Account name"
        name="name"
        placeholder="Binance main"
        defaultValue={keep.name ?? defaults?.name}
        hint="Something you will recognise in a dropdown."
        error={state.fieldErrors?.name}
        required
      />

      <Input
        label="Broker or exchange"
        name="broker"
        placeholder="Binance"
        defaultValue={keep.broker ?? defaults?.broker ?? ''}
        error={state.fieldErrors?.broker}
      />

      <Select
        label="Market"
        name="market"
        options={MARKETS}
        value={market}
        onChange={(e) => setMarket(e.target.value)}
        hint={CONTRACT_HINT[market]}
        error={state.fieldErrors?.market}
      />

      <div className="grid grid-cols-[1fr_7rem] gap-3">
        <Input
          label="Starting balance"
          name="startingBalance"
          type="number"
          step="any"
          min="0"
          placeholder="10000"
          defaultValue={keep.startingBalance ?? defaults?.startingBalance ?? 0}
          hint="Used for drawdown and return percentages."
          error={state.fieldErrors?.startingBalance}
          required
        />
        <Select
          label="Currency"
          name="currency"
          options={CURRENCIES}
          defaultValue={keep.currency ?? defaults?.currency ?? 'USD'}
          error={state.fieldErrors?.currency}
        />
      </div>

      <SubmitButton size="lg" className="w-full">
        {submitLabel}
      </SubmitButton>
    </form>
  );
}
