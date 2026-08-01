import { createHash } from 'node:crypto';
import { z } from 'zod';
import { computeTradeResult } from '@/lib/metrics';
import type { Trade } from '@/lib/types/trade';
import type { PortfolioStats } from '@/lib/metrics';

/**
 * The model's job is to read one trade against the trader's own history and
 * comment on process. It is explicitly told not to grade the outcome, because
 * a journal that praises lucky wins teaches exactly the wrong lesson.
 */
export const TRADE_REVIEW_SYSTEM = `You review individual trades in a trading journal.

Rules you must follow:
- Judge the process, never the outcome. A loss that followed the plan is good execution. A win taken without a stop is bad execution regardless of the profit.
- Only use the numbers given to you. Never estimate a price, a date, or a statistic that is not in the input.
- If a field is missing, say what is missing and why it matters. Do not guess it.
- Never give trading advice, price predictions, or tell the user what to trade next. Comment only on what already happened.
- Be specific and short. No encouragement, no filler, no restating the numbers back.
- If there is nothing worth saying, return fewer findings rather than padding.

Return only JSON matching this shape, with no markdown fence:
{
  "summary": "one or two sentences on how this trade was executed",
  "findings": [
    { "kind": "strength" | "weakness" | "note", "text": "one specific observation" }
  ],
  "scores": { "execution": 1-10, "risk": 1-10, "discipline": 1-10 }
}

Scores: execution is plan adherence, risk is position sizing and stop placement, discipline is whether the trade fit the trader's own stated rules and history. Use the full range; 7 is not a default.`;

export const reviewSchema = z.object({
  summary: z.string().trim().min(1).max(600),
  findings: z
    .array(
      z.object({
        kind: z.enum(['strength', 'weakness', 'note']),
        text: z.string().trim().min(1).max(400),
      }),
    )
    .max(8)
    .default([]),
  scores: z.object({
    execution: z.number().int().min(1).max(10),
    risk: z.number().int().min(1).max(10),
    discipline: z.number().int().min(1).max(10),
  }),
});

export type TradeReview = z.infer<typeof reviewSchema>;

/**
 * Models wrap JSON in fences, prepend prose, or emit trailing commentary even
 * when told not to. Anything the schema rejects is treated as a failure —
 * a half-parsed review is worse than none.
 */
export function parseReview(raw: string): TradeReview | null {
  if (!raw) return null;

  let text = raw.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence?.[1]) text = fence[1].trim();

  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;

  try {
    const parsed = reviewSchema.safeParse(JSON.parse(text.slice(start, end + 1)));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function line(label: string, value: string | number | null | undefined): string {
  return value === null || value === undefined || value === '' ? '' : `${label}: ${value}\n`;
}

/**
 * Builds the prompt from the trade plus the trader's own record with that
 * setup. Context is what makes the review worth reading — without it the
 * model can only restate the trade back.
 */
export function buildTradeReviewPrompt(
  trade: Trade,
  currency: string,
  context: { setupStats?: PortfolioStats | null; accountStats?: PortfolioStats | null } = {},
): string {
  const r = computeTradeResult(trade);
  const money = (v: number | null) =>
    v === null ? 'not recorded' : `${currency} ${v.toFixed(2)}`;

  let prompt = 'THE TRADE\n';
  prompt += line('Symbol', trade.symbol);
  prompt += line('Direction', trade.direction);
  prompt += line('Status', trade.status);
  prompt += line('Opened', trade.openedAt);
  prompt += line('Closed', trade.closedAt ?? 'still open');
  prompt += line('Quantity', trade.quantity);
  prompt += line('Entry price', trade.entryPrice);
  prompt += line('Exit price', trade.exitPrice ?? 'not recorded');
  prompt += line('Stop loss', trade.stopLoss ?? 'NOT SET');
  prompt += line('Take profit', trade.takeProfit ?? 'not set');
  prompt += line('Costs', money(r.costs));
  prompt += line('Net result', trade.status === 'closed' ? money(r.netPnl) : 'open');
  prompt += line('Planned reward to risk', r.plannedRr === null ? 'unknown, no stop or target' : r.plannedRr.toFixed(2));
  prompt += line('Result in R', r.rMultiple === null ? 'cannot be computed, no stop was set' : r.rMultiple.toFixed(2));
  prompt += line('Risk in currency', r.riskAmount === null ? 'unknown, no stop was set' : money(r.riskAmount));

  prompt += '\nWHAT THE TRADER RECORDED\n';
  prompt += line('Setup', trade.setup ?? 'not tagged');
  prompt += line('Timeframe', trade.timeframe ?? 'not tagged');
  prompt += line('Session', trade.session ?? 'not tagged');
  prompt += line('Market condition', trade.marketCondition ?? 'not tagged');
  prompt += line('Emotion going in', trade.emotion ?? 'not recorded');
  prompt += line('Confidence out of 10', trade.confidence ?? 'not recorded');
  prompt += line('Self-rated execution out of 10', trade.executionRating ?? 'not recorded');
  prompt += line('Notes', trade.notes ?? 'none written');

  if (context.setupStats && context.setupStats.closedTrades > 0) {
    const s = context.setupStats;
    prompt += `\nTHIS TRADER'S RECORD WITH ${(trade.setup ?? 'this setup').toUpperCase()}\n`;
    prompt += line('Trades taken', s.closedTrades);
    prompt += line('Win rate', s.winRate === null ? 'unknown' : `${s.winRate.toFixed(1)}%`);
    prompt += line('Average R', s.expectancyR === null ? 'unknown' : s.expectancyR.toFixed(2));
    prompt += line('Net result', money(s.netPnl));
    if (s.closedTrades < 10) {
      prompt += 'Note: fewer than 10 trades, so this record is not yet reliable.\n';
    }
  }

  if (context.accountStats && context.accountStats.closedTrades > 0) {
    const s = context.accountStats;
    prompt += '\nTHE ACCOUNT OVERALL\n';
    prompt += line('Closed trades', s.closedTrades);
    prompt += line('Win rate', s.winRate === null ? 'unknown' : `${s.winRate.toFixed(1)}%`);
    prompt += line('Average R', s.expectancyR === null ? 'unknown' : s.expectancyR.toFixed(2));
    prompt += line('Average winner', money(s.avgWin));
    prompt += line('Average loser', money(s.avgLoss));
  }

  return prompt;
}

/**
 * Identical input must never be billed twice. The hash covers only the fields
 * the review depends on, so editing a note produces a new review while
 * re-opening the page does not.
 */
export function reviewInputHash(prompt: string, model: string): string {
  return createHash('sha256').update(`${model}\n${prompt}`).digest('hex').slice(0, 40);
}
