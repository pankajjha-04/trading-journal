'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { CheckCircle2, FileUp, Upload } from 'lucide-react';
import { parseCsv } from '@/lib/import/csv';
import {
  FIELD_LABELS,
  IMPORT_FIELDS,
  REQUIRED_FIELDS,
  guessMapping,
  inferContractSizes,
  mapRow,
  type ImportField,
} from '@/lib/import/map';
import { importTrades, type ImportResult } from '@/app/journal/import/actions';
import { computeTradeResult } from '@/lib/metrics';
import { formatCurrency } from '@/lib/utils/format';
import { Button } from '@/components/ui/button';
import { FormAlert } from '@/components/auth/form-alert';
import { cn } from '@/lib/utils/cn';
import type { AccountSummary } from '@/lib/data/trades';
import type { Trade } from '@/lib/types/trade';

const MAX_BYTES = 5 * 1024 * 1024;

export function ImportWizard({ accounts }: { accounts: AccountSummary[] }) {
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '');
  const [fileName, setFileName] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Partial<Record<ImportField, number>>>({});
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

    const text = await file.text();
    const parsed = parseCsv(text);

    if (parsed.headers.length === 0 || parsed.rows.length === 0) {
      setReadError('No rows found. Is the first line a header row?');
      return;
    }

    setReadError(null);
    setFileName(file.name);
    setHeaders(parsed.headers);
    setRows(parsed.rows);
    setMapping(guessMapping(parsed.headers));
  }

  // Worked out before the rows are mapped, so gold at 100 ounces a lot and
  // forex at 100,000 units do not both import as 1.
  const contractSizes = useMemo(
    () => inferContractSizes(rows, mapping),
    [rows, mapping],
  );

  // Symbols the P&L column could not settle, so the user is told rather than
  // silently given a wrong multiplier.
  const unknownSymbols = useMemo(() => {
    if (mapping.netPnl === undefined || mapping.symbol === undefined) return [];
    const column = mapping.symbol;
    const seen = new Set<string>();
    for (const row of rows) {
      const symbol = (row[column] ?? '').trim().toUpperCase();
      if (symbol && !contractSizes[symbol]) seen.add(symbol);
    }
    return [...seen].slice(0, 8);
  }, [rows, mapping, contractSizes]);

  const mapped = useMemo(
    () =>
      rows.map((row, i) =>
        mapRow(row, mapping, i, { dayFirst, defaultContractSize: 1 }),
      ),
    [rows, mapping, dayFirst],
  );

  const missing = REQUIRED_FIELDS.filter((field) => mapping[field] === undefined);

  // Counted client-side so the problem is visible before anything is sent.
  const unreadable = mapped.filter(
    (row) =>
      !row.values.symbol ||
      row.values.direction === null ||
      row.values.openedAt === null ||
      row.values.quantity === null ||
      row.values.entryPrice === null,
  ).length;

  function submit() {
    if (!account) return;
    // The preview and the payload were building different objects, so the
    // market and the worked-out contract sizes never reached the server.
    // One object now, used for both.
    const payload = JSON.stringify(
      mapped.map((row) => {
        const symbol = String(row.values.symbol ?? '');
        return {
          ...row.values,
          market: account?.market ?? 'crypto',
          contractSize: contractSizes[symbol] ?? row.values.contractSize ?? 1,
        };
      }),
    );
    startTransition(async () => {
      setResult(await importTrades(account.id, payload));
    });
  }

  if (result?.ok) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-line bg-surface p-6 text-center">
          <CheckCircle2 aria-hidden className="mx-auto size-8 text-gain" />
          <h2 className="mt-3 font-display text-lg font-semibold">
            Imported {result.imported} {result.imported === 1 ? 'trade' : 'trades'}
          </h2>
          <p className="mt-1 text-sm text-fg-muted">
            {result.skipped > 0
              ? `${result.skipped} rows were skipped — already imported, or they could not be read.`
              : 'Every row went in cleanly.'}
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

        {result.errors.length > 0 ? <ErrorTable errors={result.errors} /> : null}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {readError ? <FormAlert tone="error" message={readError} /> : null}
      {result && !result.ok && result.message ? (
        <FormAlert tone="error" message={result.message} />
      ) : null}

      <section className="rounded-xl border border-line bg-surface p-5">
        <h2 className="text-sm font-semibold">1. Choose a file</h2>
        <p className="mt-0.5 text-xs text-fg-muted">
          CSV exported from your broker or exchange. The first row must be headers.
        </p>

        <label
          className={cn(
            'mt-4 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-line px-6 py-10 text-center transition-colors',
            'hover:border-line-strong hover:bg-surface-2',
          )}
        >
          <FileUp aria-hidden className="size-6 text-fg-subtle" />
          <span className="text-sm font-medium">
            {fileName ?? 'Drop a CSV here, or click to browse'}
          </span>
          <span className="text-2xs text-fg-subtle">Up to 5 MB, 2,000 rows</span>
          <input
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={(e) => void onFile(e.target.files?.[0])}
          />
        </label>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label
              htmlFor="import-account"
              className="mb-1.5 block text-xs font-medium text-fg-muted"
            >
              Import into
            </label>
            <select
              id="import-account"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="h-10 w-full rounded-md bg-surface-2 px-3 text-sm ring-1 ring-inset ring-line focus:outline-none focus:ring-2 focus:ring-iris-500"
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="import-dayfirst"
              className="mb-1.5 block text-xs font-medium text-fg-muted"
            >
              Date order
            </label>
            <select
              id="import-dayfirst"
              value={dayFirst ? 'dmy' : 'mdy'}
              onChange={(e) => setDayFirst(e.target.value === 'dmy')}
              className="h-10 w-full rounded-md bg-surface-2 px-3 text-sm ring-1 ring-inset ring-line focus:outline-none focus:ring-2 focus:ring-iris-500"
            >
              <option value="dmy">Day first — 04/01/2025 is 4 January</option>
              <option value="mdy">Month first — 04/01/2025 is 1 April</option>
            </select>
          </div>
        </div>
      </section>

      {headers.length > 0 ? (
        <>
            {Object.keys(contractSizes).length > 0 ? (
              <div className="mt-4 rounded-md bg-surface-2 px-3 py-2.5 text-xs text-fg-muted">
                <p>
                  Contract size worked out from your P&amp;L column:{' '}
                  {Object.entries(contractSizes)
                    .map(([symbol, size]) => `${symbol} = ${size.toLocaleString()}`)
                    .join(', ')}
                  .
                </p>
                {unknownSymbols.length > 0 ? (
                  <p className="mt-1.5 text-fg-subtle">
                    Not enough rows to be sure about {unknownSymbols.join(', ')} — those
                    import at 1. Fix the contract size on those trades afterwards if it
                    matters.
                  </p>
                ) : null}
              </div>
            ) : null}

          <section className="rounded-xl border border-line bg-surface p-5">
            <h2 className="text-sm font-semibold">2. Match the columns</h2>
            <p className="mt-0.5 text-xs text-fg-muted">
              We guessed from the headers. Change anything that looks wrong.
            </p>

            {missing.length > 0 ? (
              <p className="mt-3 rounded-md bg-loss-soft px-3 py-2 text-xs text-loss">
                Still needed: {missing.map((f) => FIELD_LABELS[f]).join(', ')}
              </p>
            ) : null}

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {IMPORT_FIELDS.map((field) => (
                <div key={field}>
                  <label
                    htmlFor={`map-${field}`}
                    className="mb-1 block text-xs text-fg-muted"
                  >
                    {FIELD_LABELS[field]}
                    {REQUIRED_FIELDS.includes(field) ? (
                      <span className="ml-1 text-loss">*</span>
                    ) : null}
                  </label>
                  <select
                    id={`map-${field}`}
                    value={mapping[field] ?? ''}
                    onChange={(e) =>
                      setMapping((m) => ({
                        ...m,
                        [field]: e.target.value === '' ? undefined : Number(e.target.value),
                      }))
                    }
                    className="h-9 w-full rounded-md bg-surface-2 px-2 text-xs ring-1 ring-inset ring-line focus:outline-none focus:ring-2 focus:ring-iris-500"
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

          <section className="overflow-hidden rounded-xl border border-line bg-surface">
            <div className="border-b border-line px-5 py-3.5">
              <h2 className="text-sm font-semibold">3. Check the first rows</h2>
              <p className="mt-0.5 text-xs text-fg-muted">
                {rows.length} rows found
                {unreadable > 0
                  ? ` · ${unreadable} cannot be read yet and will be skipped`
                  : ' · all readable'}
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-xs">
                <thead>
                  <tr className="border-b border-line text-left text-fg-muted">
                    {['Symbol', 'Side', 'Opened', 'Qty', 'Entry', 'Exit', 'Net'].map((h) => (
                      <th key={h} scope="col" className="px-4 py-2 font-medium">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {mapped.slice(0, 5).map((row) => {
                    const v = row.values as Record<string, string | number | null>;
                    const broken = !v.symbol || v.direction === null || v.openedAt === null;

                    const preview =
                      v.status === 'closed' && typeof v.entryPrice === 'number'
                        ? computeTradeResult({
                            id: 'p',
                            accountId,
                            symbol: String(v.symbol),
                            market: (account?.market ?? 'crypto') as Trade['market'],
                            direction: v.direction === 'short' ? 'short' : 'long',
                            status: 'closed',
                            openedAt: String(v.openedAt),
                            closedAt: String(v.closedAt),
                            quantity: Number(v.quantity) || 0,
                            contractSize:
                              (v.symbol ? contractSizes[v.symbol] : undefined) ??
                              (Number(v.contractSize) || 1),
                            entryPrice: Number(v.entryPrice),
                            exitPrice: Number(v.exitPrice),
                            stopLoss: null,
                            takeProfit: null,
                            fees: Number(v.fees) || 0,
                            commission: Number(v.commission) || 0,
                            swap: Number(v.swap) || 0,
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
                          })
                        : null;

                    return (
                      <tr key={row.index} className={cn(broken && 'bg-loss-soft/40')}>
                        <td className="px-4 py-2 font-medium">{v.symbol || '—'}</td>
                        <td className="px-4 py-2">{v.direction ?? '—'}</td>
                        <td className="px-4 py-2 text-fg-muted">
                          {v.openedAt
                            ? new Date(String(v.openedAt)).toLocaleString(undefined, {
                                day: '2-digit',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : '—'}
                        </td>
                        <td className="px-4 py-2 font-mono tnum">{v.quantity ?? '—'}</td>
                        <td className="px-4 py-2 font-mono tnum">{v.entryPrice ?? '—'}</td>
                        <td className="px-4 py-2 font-mono tnum">{v.exitPrice ?? 'Open'}</td>
                        <td
                          className={cn(
                            'px-4 py-2 font-mono tnum',
                            preview && preview.netPnl > 0 && 'text-gain',
                            preview && preview.netPnl < 0 && 'text-loss',
                          )}
                        >
                          {preview
                            ? formatCurrency(preview.netPnl, account?.currency ?? 'USD', {
                                signed: true,
                              })
                            : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center gap-3 border-t border-line px-5 py-4">
              <Button
                loading={pending}
                disabled={missing.length > 0 || rows.length === 0}
                leadingIcon={<Upload className="size-4" />}
                onClick={submit}
              >
                Import {rows.length - unreadable} trades
              </Button>
              <p className="text-2xs text-fg-subtle">
                Rows with an order ID will not duplicate if you import this file twice.
              </p>
            </div>
          </section>
        </>
      ) : null}

      {result && !result.ok && result.errors.length > 0 ? (
        <ErrorTable errors={result.errors} />
      ) : null}
    </div>
  );
}

function ErrorTable({ errors }: { errors: ImportResult['errors'] }) {
  return (
    <section className="overflow-hidden rounded-xl border border-line bg-surface">
      <div className="border-b border-line px-5 py-3.5">
        <h2 className="text-sm font-semibold">Rows that were skipped</h2>
        <p className="mt-0.5 text-xs text-fg-muted">
          Fix these in the file and import it again — the ones that went in will
          not duplicate.
        </p>
      </div>
      <ul className="divide-y divide-line text-xs">
        {errors.map((error) => (
          <li key={`${error.row}-${error.field}`} className="flex gap-4 px-5 py-2">
            <span className="w-16 shrink-0 font-mono text-fg-subtle tnum">
              Row {error.row}
            </span>
            <span className="w-28 shrink-0 text-fg-muted">{error.field}</span>
            <span>{error.message}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
