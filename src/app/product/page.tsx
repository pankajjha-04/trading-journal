import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { SiteHeader } from '@/components/marketing/site-header';
import { SiteFooter } from '@/components/marketing/site-footer';
import { EquityUnderwater } from '@/components/marketing/equity-underwater';
import { SetupProof } from '@/components/marketing/sections';

export const metadata: Metadata = {
  title: 'How a real account reads',
  description:
    'A worked example: 197 trades over three months, and what the breakdowns actually say about them.',
  alternates: { canonical: '/product' },
};

const STATS = [
  ['Closed trades', '197'],
  ['Win rate', '44.7%'],
  ['Profit factor', '1.40'],
  ['Net P&L', '+$5,007'],
  ['Max drawdown', '−14.4%'],
  ['Worst streak', '15 losses'],
];

const READINGS = [
  {
    title: 'A 44% win rate that makes money',
    body: 'Losers cluster around −1R because the stops were respected. Winners run to two and three. That asymmetry, not the hit rate, is what puts the account ahead — and it is why the overview leads with profit factor rather than win rate.',
  },
  {
    title: 'Fifteen losses in a row',
    body: 'Mid-June, the account lost fifteen trades running and gave back 14% from its high. Nothing was broken; a 44% strategy produces a run like that regularly. Knowing it already happened is what stops you abandoning a working method the next time it does.',
  },
  {
    title: 'A third of the gross went to fees',
    body: '$2,525 in costs against $5,007 net. Any edge measured before fees is a fiction, which is why costs are subtracted before the R-multiple is computed rather than reported separately at the bottom.',
  },
  {
    title: 'Two setups quietly funded by the others',
    body: 'Breaker and BOS retest lost money across 56 trades. They were profitable in memory because the wins were memorable. The table does not have that problem.',
  },
];

export default function ProductPage() {
  return (
    <>
      <SiteHeader />

      <main id="main">
        <section className="mx-auto max-w-6xl px-6 pt-20 pb-12">
          <p className="text-2xs tracking-wide text-fg-subtle uppercase">A worked example</p>
          <h1 className="mt-3 max-w-3xl font-display text-4xl leading-[1.1] font-semibold text-balance">
            197 trades, three months, and what they actually say.
          </h1>
          <p className="mt-5 max-w-xl text-lg text-fg-muted text-pretty">
            This is the sample account that ships with Ledgerline. Every number
            below is computed by the same engine your own trades run through.
          </p>

          <dl className="mt-10 grid grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-3 lg:grid-cols-6">
            {STATS.map(([label, value]) => (
              <div key={label}>
                <dt className="text-2xs tracking-wide text-fg-subtle uppercase">{label}</dt>
                <dd className="mt-1 font-mono text-lg font-semibold tnum">{value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="mx-auto max-w-6xl px-6 pb-16">
          <div className="glass rounded-2xl p-1.5">
            <div className="rounded-xl bg-surface p-5 sm:p-7">
              <h2 className="font-display text-lg font-semibold">
                The curve, and the one underneath it
              </h2>
              <p className="mt-1 text-sm text-fg-muted">
                Above: balance after each closed trade. Below: how far under the
                high-water mark the account sat, day by day.
              </p>
              <EquityUnderwater className="mt-6" />
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 pb-8">
          <h2 className="font-display text-3xl font-semibold text-balance">
            Four things this account says out loud.
          </h2>

          <div className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2">
            {READINGS.map((reading, i) => (
              <article key={reading.title} className="bg-surface p-6">
                <span className="font-mono text-2xs text-fg-subtle tnum">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <h3 className="mt-2 text-sm font-semibold">{reading.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-fg-muted">{reading.body}</p>
              </article>
            ))}
          </div>
        </section>

        <SetupProof />

        <section className="mx-auto max-w-6xl px-6 pb-24">
          <div className="rounded-2xl border border-line bg-surface p-8 text-center sm:p-12">
            <h2 className="font-display text-2xl font-semibold text-balance">
              Your own account will say something different.
            </h2>
            <p className="mx-auto mt-3 max-w-md text-sm text-fg-muted">
              Import a few months of fills and find out what. Free for the first
              fifty trades, and you can export everything back out.
            </p>
            <Link
              href="/signup"
              className="mt-7 inline-flex h-12 items-center gap-2 rounded-lg bg-iris-500 px-6 text-sm font-medium text-white ring-1 ring-white/10 ring-inset transition-colors hover:bg-iris-400"
            >
              Start your journal
              <ArrowRight aria-hidden className="size-4" />
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
