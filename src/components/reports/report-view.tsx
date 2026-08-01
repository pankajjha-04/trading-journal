import { formatCurrency, formatPercent, formatRatio } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import type { BreakdownRow, DayCell, Period, PortfolioStats } from '@/lib/metrics';

function bestAndWorst(days: DayCell[]) {
  if (days.length === 0) return { best: null, worst: null };
  let best = days[0]!;
  let worst = days[0]!;
  for (const day of days) {
    if (day.netPnl > best.netPnl) best = day;
    if (day.netPnl < worst.netPnl) worst = day;
  }
  return { best, worst };
}

function Row({ label, value, tone }: { label: string; value: string; tone?: 'gain' | 'loss' }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line py-2 last:border-0">
      <dt className="text-xs text-fg-muted">{label}</dt>
      <dd
        className={cn(
          'font-mono text-sm tnum',
          tone === 'gain' && 'text-gain',
          tone === 'loss' && 'text-loss',
        )}
      >
        {value}
      </dd>
    </div>
  );
}

/**
 * Built to survive printing: no charts, no colour-only meaning, and the
 * account and period named in the header so a printed page still says what
 * it is a month later.
 */
export function ReportView({
  accountName,
  broker,
  currency,
  period,
  stats,
  openingBalance,
  days,
  setups,
  sessions,
}: {
  accountName: string;
  broker: string | null;
  currency: string;
  period: Period;
  stats: PortfolioStats;
  openingBalance: number;
  days: DayCell[];
  setups: BreakdownRow[];
  sessions: BreakdownRow[];
}) {
  const { best, worst } = bestAndWorst(days);
  const closingBalance = openingBalance + stats.netPnl;
  const returnPct = openingBalance > 0 ? (stats.netPnl / openingBalance) * 100 : null;
  const winning = days.filter((d) => d.netPnl > 0).length;
  const losing = days.filter((d) => d.netPnl < 0).length;

  if (stats.closedTrades === 0) {
    return (
      <section className="rounded-xl border border-line bg-surface p-8 text-center">
        <h2 className="font-display text-lg font-semibold">
          Nothing closed in {period.label}
        </h2>
        <p className="mx-auto mt-2 max-w-sm text-sm text-fg-muted">
          Reports count trades by the date they closed. Pick a wider period, or
          close a position first.
        </p>
      </section>
    );
  }

  return (
    <article className="space-y-5 print:space-y-4">
      <header className="rounded-xl border border-line bg-surface p-5">
        <p className="text-2xs tracking-wide text-fg-subtle uppercase">
          Performance report
        </p>
        <h2 className="mt-1 font-display text-xl font-semibold">
          {accountName}
          {broker ? <span className="text-fg-muted"> · {broker}</span> : null}
        </h2>
        <p className="mt-1 text-sm text-fg-muted">
          {period.label} ·{' '}
          {new Date(period.from).toLocaleDateString(undefined, {
            day: 'numeric',
            month: 'short',
          })}{' '}
          to{' '}
          {new Date(period.to).toLocaleDateString(undefined, {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })}
        </p>

        <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            ['Net P&L', formatCurrency(stats.netPnl, currency, { signed: true }), stats.netPnl >= 0],
            ['Return', formatPercent(returnPct, 2, true), (returnPct ?? 0) >= 0],
            ['Win rate', formatPercent(stats.winRate, 1), null],
            ['Profit factor', formatRatio(stats.profitFactor), null],
          ].map(([label, value, positive]) => (
            <div key={String(label)}>
              <p className="text-2xs tracking-wide text-fg-subtle uppercase">{label}</p>
              <p
                className={cn(
                  'mt-1 font-mono text-lg font-semibold tnum',
                  positive === true && 'text-gain',
                  positive === false && 'text-loss',
                )}
              >
                {value}
              </p>
            </div>
          ))}
        </div>
      </header>

      <div className="grid gap-5 sm:grid-cols-2">
        <section className="rounded-xl border border-line bg-surface p-5">
          <h3 className="text-sm font-semibold">Account</h3>
          <dl className="mt-3">
            <Row label="Opening balance" value={formatCurrency(openingBalance, currency)} />
            <Row label="Closing balance" value={formatCurrency(closingBalance, currency)} />
            <Row
              label="Max drawdown"
              value={`${formatCurrency(stats.maxDrawdown, currency)} (${formatPercent(stats.maxDrawdownPct, 1)})`}
              tone={stats.maxDrawdown > 0 ? 'loss' : undefined}
            />
            <Row label="Costs paid" value={formatCurrency(stats.totalCosts, currency)} />
          </dl>
        </section>

        <section className="rounded-xl border border-line bg-surface p-5">
          <h3 className="text-sm font-semibold">Execution</h3>
          <dl className="mt-3">
            <Row label="Trades closed" value={String(stats.closedTrades)} />
            <Row label="Wins / losses" value={`${stats.wins} / ${stats.losses}`} />
            <Row label="Average R" value={stats.expectancyR === null ? '—' : `${formatRatio(stats.expectancyR)}R`} />
            <Row
              label="Expectancy"
              value={formatCurrency(stats.expectancy, currency, { signed: true })}
            />
          </dl>
        </section>

        <section className="rounded-xl border border-line bg-surface p-5">
          <h3 className="text-sm font-semibold">Days</h3>
          <dl className="mt-3">
            <Row label="Trading days" value={String(days.length)} />
            <Row label="Green / red days" value={`${winning} / ${losing}`} />
            <Row
              label="Best day"
              value={
                best
                  ? `${formatCurrency(best.netPnl, currency, { signed: true })} · ${best.date}`
                  : '—'
              }
              tone={best && best.netPnl > 0 ? 'gain' : undefined}
            />
            <Row
              label="Worst day"
              value={
                worst
                  ? `${formatCurrency(worst.netPnl, currency, { signed: true })} · ${worst.date}`
                  : '—'
              }
              tone={worst && worst.netPnl < 0 ? 'loss' : undefined}
            />
          </dl>
        </section>

        <section className="rounded-xl border border-line bg-surface p-5">
          <h3 className="text-sm font-semibold">Extremes</h3>
          <dl className="mt-3">
            <Row label="Largest win" value={formatCurrency(stats.largestWin, currency)} tone="gain" />
            <Row label="Largest loss" value={formatCurrency(stats.largestLoss, currency)} tone="loss" />
            <Row label="Longest win streak" value={`${stats.maxConsecutiveWins}`} />
            <Row label="Longest loss streak" value={`${stats.maxConsecutiveLosses}`} />
          </dl>
        </section>
      </div>

      {[
        { title: 'By setup', rows: setups },
        { title: 'By session', rows: sessions },
      ].map(({ title, rows }) =>
        rows.length === 0 ? null : (
          <section key={title} className="overflow-hidden rounded-xl border border-line bg-surface">
            <h3 className="border-b border-line px-5 py-3 text-sm font-semibold">{title}</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-fg-muted">
                  <th scope="col" className="px-5 py-2 font-medium">Group</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Trades</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Win rate</th>
                  <th scope="col" className="px-5 py-2 text-right font-medium">Net</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((row) => (
                  <tr key={row.key}>
                    <td className="px-5 py-2">{row.label}</td>
                    <td className="px-3 py-2 text-right font-mono text-fg-muted tnum">
                      {row.stats.closedTrades}
                    </td>
                    <td className="px-3 py-2 text-right font-mono tnum">
                      {formatPercent(row.stats.winRate, 0)}
                    </td>
                    <td
                      className={cn(
                        'px-5 py-2 text-right font-mono tnum',
                        row.stats.netPnl > 0 && 'text-gain',
                        row.stats.netPnl < 0 && 'text-loss',
                      )}
                    >
                      {formatCurrency(row.stats.netPnl, currency, { signed: true })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ),
      )}

      <p className="text-2xs text-fg-subtle">
        Generated {new Date().toLocaleString()} · Figures are net of fees,
        commission and swap · Open positions are excluded
      </p>
    </article>
  );
}
