import Link from 'next/link';
import {
  BarChart3,
  Braces,
  CalendarDays,
  FileDown,
  Layers,
  ShieldCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';

const FEATURES = [
  {
    icon: Layers,
    title: 'Import instead of retyping',
    body: 'CSV from Binance, Bybit, OKX, MT4, MT5 and most brokers. Columns are matched automatically, dates are read in your format, and re-importing the same file will not duplicate anything.',
  },
  {
    icon: BarChart3,
    title: 'Grouped by what you actually did',
    body: 'Setup, session, weekday, symbol, direction, timeframe, confidence. Groups under ten trades are marked, because a two-trade sample that reads 100% is not a result.',
  },
  {
    icon: CalendarDays,
    title: 'The chart nobody else shows',
    body: 'Equity curve on top, the underwater curve below it. Time spent beneath your own high-water mark is what ends accounts, and it deserves its own axis.',
  },
  {
    icon: Braces,
    title: 'Numbers that admit when they cannot answer',
    body: 'Profit factor with no losses shows a dash, not infinity. Sharpe waits for twenty trading days. A trade with no stop has no R, and none is invented for it.',
  },
  {
    icon: FileDown,
    title: 'Export everything, always',
    body: 'Full CSV of every field, or a JSON backup of your whole account. The export re-imports cleanly, so leaving costs you nothing.',
  },
  {
    icon: ShieldCheck,
    title: 'Your book stays yours',
    body: 'Row-level security on every table, so your trades are unreadable to anyone else by design rather than by policy. No ads, no data sold, no leaderboard exposing your P&L.',
  },
];

export function Features() {
  return (
    <section id="features" className="mx-auto max-w-6xl scroll-mt-20 px-6 py-20">
      <p className="text-2xs tracking-wide text-fg-subtle uppercase">What it does</p>
      <h2 className="mt-3 max-w-2xl font-display text-3xl font-semibold text-balance">
        Six things, done properly, instead of forty done badly.
      </h2>

      <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map(({ icon: Icon, title, body }) => (
          <article key={title} className="bg-surface p-6">
            <Icon aria-hidden className="size-5 text-iris-400" />
            <h3 className="mt-4 text-sm font-semibold">{title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-fg-muted">{body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

const BEFORE = [
  'A spreadsheet you stop updating by week three',
  'Win rate quoted with pride, expectancy never computed',
  '"I think I do better in London" — never checked',
  'Fees ignored, so every edge looks bigger than it is',
  'The bad month explained away and then repeated',
];

const AFTER = [
  'Fills imported in one pass, nothing retyped',
  'Expectancy and R per setup, costs already deducted',
  'London vs New York answered with a number',
  'Fees subtracted before R, so the edge is the real one',
  'The bad month sitting in the calendar, impossible to forget',
];

export function BeforeAfter() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-20">
      <p className="text-2xs tracking-wide text-fg-subtle uppercase">Why bother</p>
      <h2 className="mt-3 max-w-2xl font-display text-3xl font-semibold text-balance">
        Most traders already know their win rate. Almost none know their
        expectancy.
      </h2>
      <p className="mt-4 max-w-xl text-fg-muted">
        One of those tells you whether you make money. It is not the first one.
      </p>

      <div className="mt-12 grid gap-6 lg:grid-cols-2">
        {[
          { title: 'Without a journal', items: BEFORE, tone: 'loss' as const },
          { title: 'After six weeks of tagging', items: AFTER, tone: 'gain' as const },
        ].map(({ title, items, tone }) => (
          <div
            key={title}
            className={cn(
              'rounded-2xl border p-6',
              tone === 'loss' ? 'border-line bg-surface' : 'border-iris-500/25 bg-surface',
            )}
          >
            <h3 className="text-sm font-semibold">{title}</h3>
            <ul className="mt-4 space-y-3">
              {items.map((item) => (
                <li key={item} className="flex gap-3 text-sm text-fg-muted">
                  <span
                    aria-hidden
                    className={cn(
                      'mt-1.5 size-1.5 shrink-0 rounded-full',
                      tone === 'loss' ? 'bg-loss' : 'bg-gain',
                    )}
                  />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * Real output from the sample dataset rather than invented testimonials.
 * The table is the argument: nothing a quote could say lands harder than a
 * losing setup sitting inside a profitable account.
 */
const SAMPLE_ROWS = [
  { setup: 'Liquidity sweep', trades: 51, win: '54.9%', r: '+0.84R', net: 4267, },
  { setup: 'FVG', trades: 38, win: '55.3%', r: '+0.42R', net: 1606 },
  { setup: 'Order block', trades: 52, win: '42.3%', r: '+0.11R', net: 558 },
  { setup: 'BOS retest', trades: 33, win: '33.3%', r: '−0.17R', net: -576 },
  { setup: 'Breaker', trades: 23, win: '26.1%', r: '−0.37R', net: -848 },
];

export function SetupProof() {
  const peak = Math.max(...SAMPLE_ROWS.map((r) => Math.abs(r.net)));

  return (
    <section className="mx-auto max-w-6xl px-6 py-20">
      <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <div>
          <p className="text-2xs tracking-wide text-fg-subtle uppercase">
            The table this exists for
          </p>
          <h2 className="mt-3 font-display text-3xl font-semibold text-balance">
            A losing strategy hiding inside a winning account.
          </h2>
          <p className="mt-4 text-fg-muted">
            This account made money over 197 trades. Two of its five setups lost
            money the whole time. Without grouping, both keep getting traded —
            and the profitable ones keep paying for them.
          </p>
          <p className="mt-4 text-fg-muted">
            Look at the win rates before the P&amp;L. The setup with the highest
            win rate is not the one making the most money. That gap is the
            reason average R is the column that matters.
          </p>
          <Link
            href="/product"
            className="mt-6 inline-flex text-sm font-medium text-iris-400 hover:text-iris-300"
          >
            See the whole account →
          </Link>
        </div>

        <div className="overflow-hidden rounded-2xl border border-line bg-surface">
          <div className="border-b border-line px-5 py-3">
            <p className="text-sm font-semibold">By setup</p>
            <p className="mt-0.5 text-xs text-fg-muted">197 closed trades · 3 months</p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-fg-muted">
                <th scope="col" className="px-5 py-2 font-medium">Setup</th>
                <th scope="col" className="px-2 py-2 text-right font-medium">Trades</th>
                <th scope="col" className="px-2 py-2 text-right font-medium">Win</th>
                <th scope="col" className="px-2 py-2 text-right font-medium">Avg R</th>
                <th scope="col" className="px-5 py-2 text-right font-medium">Net</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {SAMPLE_ROWS.map((row) => (
                <tr key={row.setup} className="relative">
                  <td className="relative px-5 py-2.5">
                    <span
                      aria-hidden
                      className={cn(
                        'absolute inset-y-1 left-0 rounded-r-sm opacity-[0.13]',
                        row.net > 0 ? 'bg-gain' : 'bg-loss',
                      )}
                      style={{ width: `${(Math.abs(row.net) / peak) * 100}%` }}
                    />
                    <span className="relative">{row.setup}</span>
                  </td>
                  <td className="px-2 py-2.5 text-right font-mono text-fg-muted tnum">
                    {row.trades}
                  </td>
                  <td className="px-2 py-2.5 text-right font-mono tnum">{row.win}</td>
                  <td className="px-2 py-2.5 text-right font-mono tnum">{row.r}</td>
                  <td
                    className={cn(
                      'px-5 py-2.5 text-right font-mono font-medium tnum',
                      row.net > 0 ? 'text-gain' : 'text-loss',
                    )}
                  >
                    {row.net > 0 ? '+' : '−'}${Math.abs(row.net).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="border-t border-line px-5 py-2.5 text-2xs text-fg-subtle">
            Sample account · figures net of fees
          </p>
        </div>
      </div>
    </section>
  );
}
