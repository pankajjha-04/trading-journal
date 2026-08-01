'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { CheckCircle2, FileUp, Upload } from 'lucide-react';
import { parseCsv } from '@/lib/import/csv';
import {
  ORDER_FIELDS,
  ORDER_FIELD_LABELS,
  ORDER_REQUIRED,
  guessOrderMapping,
  reconstruct,
  type OrderField,
} from '@/lib/import/orders';
import { importTrades, type ImportResult } from '@/app/journal/import/actions';
import { formatCurrency } from '@/lib/utils/format';
import { Button } from '@/components/ui/button';
import { FormAlert } from '@/components/auth/form-alert';
import { cn } from '@/lib/utils/cn';
import type { AccountSummary } from '@/lib/data/trades';

const MAX_BYTES = 5 * 1024 * 1024;

export function OrderWizard({ accounts }: { accounts: AccountSummary[] }) {
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '');
  const [fileName, setFileName] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Partial<Record<OrderField, number>>>({});
  const [dayFirst, setDayFirst] = useState(true);
  const [readError, setReadError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [pending, startTransition] = useTransition();

  const account = accounts.find((a) => a.id === accountId) ?? accounts[0];

  async function onFile(file: File | undefined) {
    if (!file) return;
    setResult(null);

    if (file.size > MAX_BYTES) {
      setReadError('That file is over 5 MB. Split it into smaller exports.');
      return;
    }

    const parsed = parseCsv(await file.text());
    if (parsed.headers.length === 0 || parsed.rows.length === 0) {
      setReadError('No rows found. Is the first line a header row?');
      return;
    }

    setReadError(null);
    setFileName(file.name);
    setHeaders(parsed.headers);
    setRows(parsed.rows);
    setMapping(guessOrderMapping(parsed.headers));
  }

  const built = useMemo(
    () => (rows.length === 0 ? null : reconstruct(rows, mapping, { dayFirst })),
    [rows, mapping, dayFirst],
  );

  const missing = ORDER_REQUIRED.filter((field) => mapping[field] === undefined);

  // The broker's own P&L is the only external check available. If our
  // reconstruction lands far from it, something is mismapped and the import
  // should not proceed quietly.
  const drift =
    built?.reportedPnl != null && built.computedPnl != null
      ? Math.abs(built.computedPnl - built.reportedPnl)
      : null;

  const driftPct =
    drift != null && built?.reportedPnl
      ? (drift / Math.max(1, Math.abs(built.reportedPnl))) * 100
      : null;

  function submit() {
    if (!account || !built) return;

    const payload = JSON.stringify(
      built.trades.map((trade) => ({
        symbol: trade.symbol.replace('/', ''),
        direction: trade.direction,
        status: 'closed',
        openedAt: trade.openedAt,
        closedAt: trade.closedAt,
        quantity: trade.quantity,
        contractSize: trade.contractSize,
        entryPrice: trade.entryPrice,
        exitPrice: trade.exitPrice,
        stopLoss: null,
        takeProfit: null,
        fees: 0,
        commission: 0,
        swap: 0,
        setup: null,
        timeframe: null,
        session: null,
        marketCondition: null,
        emotion: null,
        confidence: null,
        executionRating: null,
        notes: null,
        externalId: trade.externalId,
      })),
    );

    startTransition(async () => {
      setResult(await importTrades(account.id, payload));
    });
  }

  if (result?.ok) {
    return (
      <div className="rounded-xl border border-line bg-surface p-6 text-center">
        <CheckCircle2 aria-hidden className="mx-auto size-8 text-gain" />
        <h2 className="mt-3 font-display text-lg font-semibold">
          Imported {result.imported} {result.imported === 1 ? 'trade' : 'trades'}
        </h2>
        <p className="mt-1 text-sm text-fg-muted">
          Rebuilt from {built?.filledOrders ?? 0} filled orders.
          {result.skipped > 0 ? ` ${result.skipped} were already in this account.` : ''}
        </p>
        <div className="mt-5 flex justify-center gap-3">
          <Link href={`/journal?account=${account?.id}`}>
            <Button>Open journal</Button>
          </Link>
          <Link href={`/analytics?account=${account?.id}`}>
            <Button variant="ghost">See analytics</Button>
          </Link>
        </div>
      </div>
    );
  }

  const field =
    'h-9 w-full rounded-md bg-surface-2 px-2 text-xs ring-1 ring-inset ring-line focus:outline-none focus:ring-2 focus:ring-iris-500';

  return (
    <div className="space-y-5">
      {readError ? <FormAlert tone="error" message={readError} /> : null}
      {result && !result.ok && result.message ? (
        <FormAlert tone="error" message={result.message} />
      ) : null}

      <section className="rounded-xl border border-line bg-surface p-5">
        <h2 className="text-sm font-semibold">1. Upload your order history</h2>
        <p className="mt-0.5 text-xs text-fg-muted">
          Every order, including the cancelled stops and targets. Those are
          filtered out — they are how we know what was live on each position.
        </p>

        <label className="mt-4 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-line px-6 py-10 text-center transition-colors hover:border-line-strong hover:bg-surface-2">
          <FileUp aria-hidden className="size-6 text-fg-subtle" />
          <span className="text-sm font-medium">
            {fileName ?? 'Drop your order history CSV here'}
          </span>
          <span className="text-2xs text-fg-subtle">Up to 5 MB</span>
          <input
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={(e) => void onFile(e.target.files?.[0])}
          />
        </label>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="order-account" className="mb-1.5 block text-xs font-medium text-fg-muted">
              Import into
            </label>
            <select
              id="order-account"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className={field}
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="order-dayfirst" className="mb-1.5 block text-xs font-medium text-fg-muted">
              Date order
            </label>
            <select
              id="order-dayfirst"
              value={dayFirst ? 'dmy' : 'mdy'}
              onChange={(e) => setDayFirst(e.target.value === 'dmy')}
              className={field}
            >
              <option value="dmy">Day first — 04/01/2026 is 4 January</option>
              <option value="mdy">Month first — 04/01/2026 is 1 April</option>
            </select>
          </div>
        </div>
      </section>

      {headers.length > 0 && built ? (
        <>
          <section className="rounded-xl border border-line bg-surface p-5">
            <h2 className="text-sm font-semibold">2. Match the columns</h2>
            <p className="mt-0.5 text-xs text-fg-muted">
              Map Status and Realised P&amp;L if your file has them — they are
              what let us drop cancelled orders and check the result.
            </p>

            {missing.length > 0 ? (
              <p className="mt-3 rounded-md bg-loss-soft px-3 py-2 text-xs text-loss">
                Still needed: {missing.map((f) => ORDER_FIELD_LABELS[f]).join(', ')}
              </p>
            ) : null}

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {ORDER_FIELDS.map((f) => (
                <div key={f}>
                  <label htmlFor={`omap-${f}`} className="mb-1 block text-xs text-fg-muted">
                    {ORDER_FIELD_LABELS[f]}
                    {ORDER_REQUIRED.includes(f) ? <span className="ml-1 text-loss">*</span> : null}
                  </label>
                  <select
                    id={`omap-${f}`}
                    value={mapping[f] ?? ''}
                    onChange={(e) =>
                      setMapping((m) => ({
                        ...m,
                        [f]: e.target.value === '' ? undefined : Number(e.target.value),
                      }))
                    }
                    className={field}
                  >
                    <option value="">Not in this file</option>
                    {headers.map((header, i) => (
                      <option key={`${header}-${i}`} value={i}>
                        {header || `Column ${i + 1}`}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-line bg-surface p-5">
            <h2 className="text-sm font-semibold">3. Check the reconstruction</h2>
            <p className="mt-0.5 text-xs text-fg-muted">
              Fills are netted oldest-first, the way your broker&apos;s ledger does it.
            </p>

            <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                ['Filled orders', String(built.filledOrders)],
                ['Ignored rows', String(built.skippedOrders)],
                ['Trades rebuilt', String(built.trades.length)],
                ['Positions left open', String(built.openLots)],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-2xs tracking-wide text-fg-subtle uppercase">{label}</dt>
                  <dd className="mt-1 font-mono text-lg font-semibold tnum">{value}</dd>
                </div>
              ))}
            </dl>

            {Object.keys(built.multipliers).length > 0 ? (
              <p className="mt-4 rounded-md bg-surface-2 px-3 py-2 text-xs text-fg-muted">
                Contract size worked out from your own P&amp;L:{' '}
                {Object.entries(built.multipliers)
                  .map(([symbol, size]) => `${symbol} = ${size}`)
                  .join(', ')}
              </p>
            ) : null}

            {built.reportedPnl != null && built.computedPnl != null ? (
              <div
                className={cn(
                  'mt-3 rounded-md px-3 py-2.5 text-xs',
                  driftPct != null && driftPct > 15
                    ? 'bg-loss-soft text-loss'
                    : 'bg-gain-soft text-gain',
                )}
              >
                <p className="font-medium">
                  {driftPct != null && driftPct > 15
                    ? 'These do not line up — check the mapping before importing'
                    : 'Reconciles with your broker'}
                </p>
                <p className="mt-1 opacity-90">
                  Your file reports{' '}
                  {formatCurrency(built.reportedPnl, account?.currency ?? 'USD', { signed: true })};
                  rebuilding from prices gives{' '}
                  {formatCurrency(built.computedPnl, account?.currency ?? 'USD', { signed: true })}.
                  The gap is usually fees and swap, which order exports rarely include.
                </p>
              </div>
            ) : null}

            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[560px] text-xs">
                <thead>
                  <tr className="border-b border-line text-left text-fg-muted">
                    {['Symbol', 'Side', 'Qty', 'Entry', 'Exit', 'Opened'].map((h) => (
                      <th key={h} scope="col" className="px-3 py-2 font-medium">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {built.trades.slice(0, 5).map((trade, i) => (
                    <tr key={`${trade.externalId}-${i}`}>
                      <td className="px-3 py-2 font-medium">{trade.symbol}</td>
                      <td className="px-3 py-2">{trade.direction}</td>
                      <td className="px-3 py-2 font-mono tnum">{trade.quantity}</td>
                      <td className="px-3 py-2 font-mono tnum">{trade.entryPrice}</td>
                      <td className="px-3 py-2 font-mono tnum">{trade.exitPrice}</td>
                      <td className="px-3 py-2 text-fg-muted">
                        {new Date(trade.openedAt).toLocaleDateString(undefined, {
                          day: '2-digit',
                          month: 'short',
                          year: '2-digit',
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Button
                loading={pending}
                disabled={missing.length > 0 || built.trades.length === 0}
                leadingIcon={<Upload className="size-4" />}
                onClick={submit}
              >
                Import {built.trades.length} trades
              </Button>
              <p className="text-2xs text-fg-subtle">
                Stops and targets are not attached — add them by editing a trade.
              </p>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
