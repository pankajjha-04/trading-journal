import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

const STEPS = [
  {
    n: '01',
    title: 'Export from your broker',
    body: 'One CSV from Binance, Bybit, OKX, MT4, MT5 or almost anywhere else. Columns are matched automatically and you correct anything that looks wrong.',
    time: '2 minutes',
  },
  {
    n: '02',
    title: 'Tag what you were doing',
    body: 'Setup, session, timeframe, and how confident you felt. Only the trades you care about — the numbers work either way, they just get sharper.',
    time: 'As you go',
  },
  {
    n: '03',
    title: 'Read the tables',
    body: 'Which setup pays, which session costs you, which day of the week you should not trade. Answers, not a wall of charts to interpret yourself.',
    time: 'Immediately',
  },
];

export function HowItWorks() {
  return (
    <section className="border-y border-line bg-surface/40">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="font-display text-2xl font-semibold text-balance">
          Set up once, in about five minutes.
        </h2>

        <ol className="mt-10 grid gap-8 sm:grid-cols-3">
          {STEPS.map((step) => (
            <li key={step.n}>
              <div className="flex items-baseline gap-3">
                <span className="font-mono text-sm text-iris-400 tnum">{step.n}</span>
                <span className="text-2xs tracking-wide text-fg-subtle uppercase">
                  {step.time}
                </span>
              </div>
              <h3 className="mt-3 text-sm font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-fg-muted">{step.body}</p>
            </li>
          ))}
        </ol>

        <Link
          href="/signup"
          className="mt-10 inline-flex items-center gap-2 text-sm font-medium text-iris-400 hover:text-iris-300"
        >
          Start with your last three months
          <ArrowRight aria-hidden className="size-4" />
        </Link>
      </div>
    </section>
  );
}
