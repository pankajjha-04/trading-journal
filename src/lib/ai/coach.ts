import 'server-only';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { breakdownBy, computePortfolioStats, computeRiskRatios } from '@/lib/metrics';
import type { Trade } from '@/lib/types/trade';

export { PRESETS, type PresetId } from './coach-presets';

export const COACH_SYSTEM = `You are reviewing a trader's own recorded history and answering questions about it.

Rules you must follow:
- Never predict price, never suggest a trade to take, never say whether to buy or sell anything. You comment on what has already happened.
- Use only the data provided. If something is not in the data, say so instead of estimating it.
- Where a group has fewer than 10 trades, say the sample is too small rather than drawing a conclusion from it.
- Judge process over outcome. A losing trade that followed the plan is better than a winning one that did not.
- Be concrete and short. Quote the specific numbers that support each point. No encouragement, no filler.
- If the data does not support an answer, say that plainly.

Return only JSON in this shape, with no markdown fence:
{
  "summary": "two or three sentences answering the question directly",
  "points": [
    { "title": "short label", "detail": "one or two sentences with the numbers behind it" }
  ],
  "nextSteps": ["a specific thing to do or check", "..."]
}

Between two and five points. At most three next steps. Next steps must be about record-keeping, risk or review habits — never about what to trade.`;

/**
 * A chart or a statement is the subject when one is attached. Sending the
 * whole account summary alongside it buries the file — the model answers from
 * the statistics because there is far more of them, which is exactly what
 * happened the first time this shipped.
 */
export const ATTACHMENT_SYSTEM = `You are reading a file a trader has uploaded — a chart screenshot, a broker statement, or a spreadsheet.

Rules you must follow:
- The uploaded file is the subject. Answer about what is in it. A short profile of the trader's account is provided only as background; do not turn the answer into a review of those statistics.
- Describe only what you can actually see. If the chart has no entry, stop or annotation marked, say so once and move on to what is visible: structure, trend, obvious levels, and where risk would sit.
- Never predict where price will go next, and never say whether to buy or sell.
- If the image is unreadable or is not a chart, say that plainly instead of guessing.
- Be specific and short. No filler.

Return only JSON in this shape, with no markdown fence:
{
  "summary": "two or three sentences answering the question about the file",
  "points": [
    { "title": "short label", "detail": "one or two sentences about what is in the file" }
  ],
  "nextSteps": ["something to record or check", "..."]
}

Between two and five points. At most three next steps.`;

export const coachSchema = z.object({
  summary: z.string().trim().min(1).max(900),
  points: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(80),
        detail: z.string().trim().min(1).max(600),
      }),
    )
    .min(1)
    .max(6),
  nextSteps: z.array(z.string().trim().min(1).max(240)).max(4).default([]),
});

export type CoachAnswer = z.infer<typeof coachSchema>;

export function parseCoachAnswer(raw: string): CoachAnswer | null {
  if (!raw) return null;
  let text = raw.trim();

  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence?.[1]) text = fence[1].trim();

  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;

  try {
    const parsed = coachSchema.safeParse(JSON.parse(text.slice(start, end + 1)));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function row(label: string, value: string | number | null): string {
  return value === null ? '' : `${label}: ${value}\n`;
}

/**
 * The account, compressed into something a model can read in one pass.
 * Individual trades are deliberately left out — 200 rows of prices crowd out
 * the summary that actually answers the question.
 */
export function buildAccountContext(
  trades: Trade[],
  currency: string,
  startingBalance: number,
): string {
  const stats = computePortfolioStats(trades, startingBalance);

  if (stats.closedTrades === 0) {
    return 'This account has no closed trades yet.';
  }

  const money = (v: number | null) => (v === null ? null : `${currency} ${v.toFixed(2)}`);
  const pct = (v: number | null) => (v === null ? null : `${v.toFixed(1)}%`);
  const num = (v: number | null) => (v === null ? null : v.toFixed(2));

  let out = 'ACCOUNT SUMMARY\n';
  out += row('Currency', currency);
  out += row('Starting balance', money(startingBalance));
  out += row('Closed trades', stats.closedTrades);
  out += row('Open trades', stats.openTrades);
  out += row('Net result', money(stats.netPnl));
  out += row('Win rate', pct(stats.winRate));
  out += row('Profit factor', num(stats.profitFactor));
  out += row('Expectancy per trade', money(stats.expectancy));
  out += row('Average R', num(stats.expectancyR));
  out += row('Average winner', money(stats.avgWin));
  out += row('Average loser', money(stats.avgLoss));
  out += row('Largest win', money(stats.largestWin));
  out += row('Largest loss', money(stats.largestLoss));
  out += row('Max drawdown', money(stats.maxDrawdown));
  out += row('Max drawdown percent', pct(stats.maxDrawdownPct));
  out += row('Longest winning streak', stats.maxConsecutiveWins);
  out += row('Longest losing streak', stats.maxConsecutiveLosses);
  out += row('Total costs paid', money(stats.totalCosts));

  const ratios = computeRiskRatios(trades, startingBalance);
  out += row('Trading days', ratios.sampleSize);
  out += row(
    'Sharpe',
    ratios.sharpe === null ? 'not enough days to report' : ratios.sharpe.toFixed(2),
  );

  const withoutStop = trades.filter((t) => t.status === 'closed' && t.stopLoss === null).length;
  out += row('Closed trades with no stop recorded', withoutStop);

  const dimensions = [
    ['BY SETUP', 'setup'],
    ['BY SESSION', 'session'],
    ['BY DAY OF WEEK', 'weekday'],
    ['BY DIRECTION', 'direction'],
    ['BY SYMBOL', 'symbol'],
    ['BY EMOTION', 'emotion'],
  ] as const;

  for (const [heading, dimension] of dimensions) {
    const rows = breakdownBy(trades, dimension, startingBalance);
    if (rows.length === 0) continue;

    out += `\n${heading}\n`;
    for (const r of rows.slice(0, 10)) {
      const flag = r.reliable ? '' : '  [sample too small]';
      out += `${r.label}: ${r.stats.closedTrades} trades, win ${pct(r.stats.winRate) ?? 'n/a'}, avg R ${num(r.stats.expectancyR) ?? 'n/a'}, net ${money(r.stats.netPnl)}${flag}\n`;
    }
  }

  return out;
}

/**
 * A few lines of background for when a file is the real subject — enough to
 * judge whether a position size was sane, not enough to hijack the answer.
 */
export function buildBriefContext(
  trades: Trade[],
  currency: string,
  startingBalance: number,
): string {
  const stats = computePortfolioStats(trades, startingBalance);
  if (stats.closedTrades === 0) {
    return `TRADER BACKGROUND\nAccount currency ${currency}, starting balance ${startingBalance}. No closed trades logged yet.`;
  }

  const avgLoss = stats.avgLoss === null ? 'unknown' : Math.abs(stats.avgLoss).toFixed(2);
  return [
    'TRADER BACKGROUND (context only — do not review this)',
    `Currency: ${currency}`,
    `Closed trades logged: ${stats.closedTrades}`,
    `Typical loss: ${currency} ${avgLoss}`,
    `Trades logged without a stop: ${trades.filter((t) => t.status === 'closed' && t.stopLoss === null).length}`,
  ].join('\n');
}

export function coachInputHash(parts: string[]): string {
  return createHash('sha256').update(parts.join('\n---\n')).digest('hex').slice(0, 40);
}