'use client';

import { useMemo, useState } from 'react';
import { computePipValue, computePositionSize, computeReward } from '@/lib/metrics';
import { formatCurrency, formatPercent, formatRatio } from '@/lib/utils/format';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/utils/cn';
import type { AccountSummary } from '@/lib/data/trades';

function Panel({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-line bg-surface p-5">
      <h2 className="text-sm font-semibold">{title}</h2>
      <p className="mt-0.5 text-xs text-fg-muted">{description}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Readout({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'gain' | 'loss' | 'warn';
}) {
  return (
    <div>
      <p className="text-2xs tracking-wide text-fg-subtle uppercase">{label}</p>
      <p
        className={cn(
          'mt-1 font-mono text-lg font-semibold tnum',
          tone === 'gain' && 'text-gain',
          tone === 'loss' && 'text-loss',
          tone === 'warn' && 'text-warn',
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-0.5 text-2xs text-fg-subtle">{hint}</p> : null}
    </div>
  );
}

export function Calculators({ accounts }: { accounts: AccountSummary[] }) {
  const first = accounts[0];
  const [accountId, setAccountId] = useState(first?.id ?? '');
  const account = accounts.find((a) => a.id === accountId) ?? first;
  const currency = account?.currency ?? 'USD';

  const [balance, setBalance] = useState(String(first?.startingBalance ?? 10000));
  const [riskPercent, setRiskPercent] = useState('1');
  const [entry, setEntry] = useState('');
  const [stop, setStop] = useState('');
  const [target, setTarget] = useState('');
  const [contractSize, setContractSize] = useState('1');

  const num = (value: string) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const sizing = useMemo(
    () =>
      computePositionSize({
        balance: num(balance),
        riskPercent: num(riskPercent),
        entryPrice: num(entry),
        stopPrice: num(stop),
        contractSize: num(contractSize) || 1,
      }),
    [balance, riskPercent, entry, stop, contractSize],
  );

  const reward = useMemo(
    () =>
      computeReward({
        entryPrice: num(entry),
        stopPrice: num(stop),
        targetPrice: num(target),
      }),
    [entry, stop, target],
  );

  const [pipSymbol, setPipSymbol] = useState('EURUSD');
  const [pipLots, setPipLots] = useState('1');
  const [pipRate, setPipRate] = useState('1');

  const pip = useMemo(
    () =>
      computePipValue({
        symbol: pipSymbol,
        lots: num(pipLots),
        contractSize: 100_000,
        quoteRate: num(pipRate) || 1,
      }),
    [pipSymbol, pipLots, pipRate],
  );

  return (
    <div className="space-y-5">
      <Panel
        title="Position size"
        description="Decide what you are willing to lose, then let the stop decide the size. Never the other way round."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.length > 1 ? (
            <Select
              label="Account"
              options={accounts.map((a) => ({ value: a.id, label: a.name }))}
              value={accountId}
              onChange={(e) => {
                setAccountId(e.target.value);
                const next = accounts.find((a) => a.id === e.target.value);
                if (next) setBalance(String(next.startingBalance));
              }}
            />
          ) : null}
          <Input
            label={`Balance (${currency})`}
            type="number"
            step="any"
            min="0"
            value={balance}
            onChange={(e) => setBalance(e.target.value)}
          />
          <Input
            label="Risk %"
            type="number"
            step="any"
            min="0"
            max="100"
            value={riskPercent}
            onChange={(e) => setRiskPercent(e.target.value)}
            hint="Most professionals stay at or under 1%."
          />
          <Input
            label="Entry price"
            type="number"
            step="any"
            value={entry}
            onChange={(e) => setEntry(e.target.value)}
          />
          <Input
            label="Stop price"
            type="number"
            step="any"
            value={stop}
            onChange={(e) => setStop(e.target.value)}
          />
          <Input
            label="Contract size"
            type="number"
            step="any"
            min="0"
            value={contractSize}
            onChange={(e) => setContractSize(e.target.value)}
            hint="1 for crypto and stocks, 100,000 per forex lot, 100 for gold."
          />
        </div>

        <div className="mt-5 grid grid-cols-2 gap-4 rounded-lg bg-surface-2 p-4 sm:grid-cols-4">
          <Readout label="Risking" value={formatCurrency(sizing.riskAmount, currency)} />
          <Readout
            label="Position size"
            value={sizing.quantity === null ? '—' : sizing.quantity.toFixed(6).replace(/\.?0+$/, '')}
            hint={sizing.reason}
            tone={sizing.quantity === null ? 'warn' : undefined}
          />
          <Readout
            label="Notional"
            value={sizing.notional === null ? '—' : formatCurrency(sizing.notional, currency, { compact: true })}
          />
          <Readout
            label="Leverage"
            value={sizing.leverage === null ? '—' : `${formatRatio(sizing.leverage, 1)}×`}
            tone={sizing.leverage !== null && sizing.leverage > 10 ? 'warn' : undefined}
            hint={sizing.leverage !== null && sizing.leverage > 10 ? 'That is a lot of exposure' : undefined}
          />
        </div>
      </Panel>

      <Panel
        title="Reward to risk"
        description="And the win rate that ratio needs before it makes you anything."
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <Input
            label="Entry price"
            type="number"
            step="any"
            value={entry}
            onChange={(e) => setEntry(e.target.value)}
          />
          <Input
            label="Stop price"
            type="number"
            step="any"
            value={stop}
            onChange={(e) => setStop(e.target.value)}
          />
          <Input
            label="Target price"
            type="number"
            step="any"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
          />
        </div>

        <div className="mt-5 grid grid-cols-2 gap-4 rounded-lg bg-surface-2 p-4 sm:grid-cols-3">
          <Readout label="Reward to risk" value={reward.ratio === null ? '—' : `${formatRatio(reward.ratio)}:1`} />
          <Readout
            label="Breakeven win rate"
            value={reward.breakevenWinRate === null ? '—' : formatPercent(reward.breakevenWinRate, 1)}
            hint="Below this you lose money"
          />
          <Readout
            label="Risk per unit"
            value={reward.risk === 0 ? '—' : reward.risk.toFixed(4).replace(/\.?0+$/, '')}
          />
        </div>
      </Panel>

      <Panel title="Pip value" description="For forex sizing, per standard lot of 100,000 units.">
        <div className="grid gap-4 sm:grid-cols-3">
          <Input
            label="Pair"
            value={pipSymbol}
            onChange={(e) => setPipSymbol(e.target.value.toUpperCase())}
            hint="JPY pairs use a different pip size — handled automatically."
          />
          <Input
            label="Lots"
            type="number"
            step="any"
            min="0"
            value={pipLots}
            onChange={(e) => setPipLots(e.target.value)}
          />
          <Input
            label="Quote rate"
            type="number"
            step="any"
            min="0"
            value={pipRate}
            onChange={(e) => setPipRate(e.target.value)}
            hint="1 when the quote currency matches your account."
          />
        </div>

        <div className="mt-5 rounded-lg bg-surface-2 p-4">
          <Readout label="Value per pip" value={formatCurrency(pip, currency)} />
        </div>
      </Panel>
    </div>
  );
}
