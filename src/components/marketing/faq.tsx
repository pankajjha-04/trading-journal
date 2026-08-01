const QUESTIONS = [
  {
    q: 'Do I have to log every trade by hand?',
    a: 'No. Export a CSV from your broker or exchange and import it — columns are matched automatically and you can correct any of them. Manual entry exists for the trades you want to write notes on.',
  },
  {
    q: 'What happens if I import the same file twice?',
    a: 'Nothing duplicates, as long as your export includes an order ID and you map that column. Rows without an ID are inserted as new, so map it if your broker provides one.',
  },
  {
    q: 'Why does profit factor sometimes show a dash?',
    a: 'Because you have not lost yet. Profit factor is gross profit divided by gross loss, and dividing by zero is not infinity — it is undefined. A dash is the honest answer until you have a losing trade.',
  },
  {
    q: 'Why is Sharpe empty on my new account?',
    a: 'Risk-adjusted ratios need at least twenty trading days. Below that they swing wildly on a single result, and a number that moves that much is worse than no number.',
  },
  {
    q: 'I did not set a stop. Why is there no R?',
    a: 'R is your result measured in units of planned risk. With no stop there was no planned risk, so there is nothing to measure against. Back-filling it from the loss would make every losing trade look like a disciplined −1R.',
  },
  {
    q: 'Can I get my data out?',
    a: 'A full CSV of every field, or a JSON backup of your entire account, at any time. The CSV re-imports cleanly, so moving to something else costs you nothing but time.',
  },
  {
    q: 'Who can see my trades?',
    a: 'Only you. Every table has row-level security, so access is enforced by the database rather than by application code remembering to check. There is no public leaderboard.',
  },
  {
    q: 'Does it give trading advice?',
    a: 'No. It records what you already did and reports it accurately. Any conclusion is yours.',
  },
];

export function Faq() {
  return (
    <section id="faq" className="mx-auto max-w-3xl scroll-mt-20 px-6 py-20">
      <p className="text-2xs tracking-wide text-fg-subtle uppercase">Questions</p>
      <h2 className="mt-3 font-display text-3xl font-semibold text-balance">
        The ones worth answering.
      </h2>

      <div className="mt-10 divide-y divide-line border-y border-line">
        {QUESTIONS.map(({ q, a }) => (
          // <details> rather than a JS accordion: it is keyboard accessible,
          // findable with the browser's own search, and ships no JavaScript.
          <details key={q} className="group py-4">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-medium">
              {q}
              <span
                aria-hidden
                className="shrink-0 text-fg-subtle transition-transform group-open:rotate-45"
              >
                +
              </span>
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-fg-muted">{a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
