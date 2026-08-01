import Link from 'next/link';
import { ArrowRight, Check } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

/**
 * Conversion order, top to bottom: what it is, proof it works, what it costs
 * you to try. The old hero opened with a metaphor — clever, but a visitor
 * cannot tell what the product does inside three seconds, and that is the
 * only window there is.
 */

const SAMPLE_ROWS = [
  { setup: 'Liquidity sweep', trades: 51, win: '54.9%', r: '+0.84R', net: 4267 },
  { setup: 'FVG', trades: 38, win: '55.3%', r: '+0.42R', net: 1606 },
  { setup: 'Order block', trades: 52, win: '42.3%', r: '+0.11R', net: 558 },
  { setup: 'BOS retest', trades: 33, win: '33.3%', r: '−0.17R', net: -576 },
  { setup: 'Breaker', trades: 23, win: '26.1%', r: '−0.37R', net: -848 },
];

function ProofTable() {
  const peak = Math.max(...SAMPLE_ROWS.map((r) => Math.abs(r.net)));

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-e3">
      <div className="flex items-baseline justify-between border-b border-line px-4 py-2.5">
        <p className="text-xs font-semibold">Performance by setup</p>
        <p className="font-mono text-2xs text-fg-subtle tnum">197 trades · 3 months</p>
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-line text-left text-2xs text-fg-muted">
            <th scope="col" className="px-4 py-1.5 font-medium">Setup</th>
            <th scope="col" className="px-2 py-1.5 text-right font-medium">Win</th>
            <th scope="col" className="px-2 py-1.5 text-right font-medium">Avg R</th>
            <th scope="col" className="px-4 py-1.5 text-right font-medium">Net</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {SAMPLE_ROWS.map((row) => (
            <tr key={row.setup}>
              <td className="relative px-4 py-2">
                <span
                  aria-hidden
                  className={cn(
                    'absolute inset-y-0.5 left-0 rounded-r-sm opacity-[0.13]',
                    row.net > 0 ? 'bg-gain' : 'bg-loss',
                  )}
                  style={{ width: `${(Math.abs(row.net) / peak) * 100}%` }}
                />
                <span className="relative">{row.setup}</span>
              </td>
              <td className="px-2 py-2 text-right font-mono tnum">{row.win}</td>
              <td className="px-2 py-2 text-right font-mono tnum">{row.r}</td>
              <td
                className={cn(
                  'px-4 py-2 text-right font-mono font-medium tnum',
                  row.net > 0 ? 'text-gain' : 'text-loss',
                )}
              >
                {row.net > 0 ? '+' : '−'}${Math.abs(row.net).toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div aria-hidden className="grid-noise pointer-events-none absolute inset-0" />

      <div className="relative mx-auto grid max-w-6xl gap-12 px-6 pt-16 pb-20 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:pt-24">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-line bg-surface-2 px-3 py-1 text-2xs font-medium tracking-wide text-fg-muted uppercase">
            <span className="size-1.5 rounded-full bg-gain" aria-hidden />
            Imports from Binance, Bybit, OKX, MT4 and MT5
          </p>

          <h1 className="mt-6 font-display text-4xl leading-[1.05] font-semibold text-balance sm:text-5xl">
            Find out which of your setups actually makes money.
          </h1>

          <p className="mt-5 max-w-lg text-lg text-fg-muted text-pretty">
            Import your trade history, tag each entry with the setup you took,
            and Ledgerline shows you — in one table — which ones pay and which
            ones you have been quietly funding.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/signup"
              className="inline-flex h-12 items-center gap-2 rounded-lg bg-iris-500 px-6 text-sm font-medium text-white ring-1 ring-white/10 ring-inset transition-colors hover:bg-iris-400"
            >
              Import your last 3 months free
              <ArrowRight aria-hidden className="size-4" />
            </Link>
            <Link
              href="/product"
              className="inline-flex h-12 items-center rounded-lg px-5 text-sm font-medium text-fg-muted ring-1 ring-line ring-inset transition-colors hover:bg-surface-2 hover:text-fg"
            >
              See a real account first
            </Link>
          </div>

          {/* Every objection a trader raises before signing up, answered in
              four words each, right under the button that asks them to. */}
          <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs text-fg-subtle">
            {[
              'No card required',
              '50 trades free',
              'CSV import, no retyping',
              'Export everything, any time',
            ].map((item) => (
              <li key={item} className="inline-flex items-center gap-1.5">
                <Check aria-hidden className="size-3.5 text-gain" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="lg:pl-4">
          <ProofTable />
          <p className="mt-3 text-xs text-fg-subtle">
            Real output from the sample account. This trader was up{' '}
            <span className="font-mono text-fg-muted tnum">$5,007</span> overall —
            while two of his five setups lost money the entire time.
          </p>
        </div>
      </div>
    </section>
  );
}
