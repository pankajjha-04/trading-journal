import type { Trade } from '@/lib/types/trade';
import { computePortfolioStats } from './portfolio';
import { computeTradeResult } from './trade';
import { sortClosed } from './portfolio';

export type GoalMetric =
  | 'net_pnl'
  | 'win_rate'
  | 'profit_factor'
  | 'trade_count'
  | 'max_risk'
  | 'discipline';

export type GoalPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface GoalProgress {
  /** Where the trader currently stands. Null when nothing can be measured yet. */
  current: number | null;
  target: number;
  /** 0–1, clamped. Null when there is nothing to show a bar for. */
  ratio: number | null;
  met: boolean;
  /** Trades counted toward this goal in the current window. */
  sampleSize: number;
  windowStart: string;
  windowEnd: string;
  /**
   * True when a lower number is better — max risk is a ceiling, not a target,
   * and a progress bar that fills as you breach it would read backwards.
   */
  lowerIsBetter: boolean;
}

export const METRIC_LABELS: Record<GoalMetric, string> = {
  net_pnl: 'Net P&L',
  win_rate: 'Win rate',
  profit_factor: 'Profit factor',
  trade_count: 'Trades taken',
  max_risk: 'Largest loss',
  discipline: 'Trades with a stop',
};

export const METRIC_HINTS: Record<GoalMetric, string> = {
  net_pnl: 'Money made in the period.',
  win_rate: 'Percentage of decided trades won.',
  profit_factor: 'Gross profit divided by gross loss.',
  trade_count: 'How many trades you closed. Useful as a ceiling, not a target.',
  max_risk: 'Your worst single loss. A limit to stay under.',
  discipline: 'Percentage of trades that had a stop recorded.',
};

export const LOWER_IS_BETTER: GoalMetric[] = ['max_risk'];

/** Start and end of the window a goal is measured over, in the local timezone. */
export function goalWindow(period: GoalPeriod, now = new Date()): { start: Date; end: Date } {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  switch (period) {
    case 'weekly':
      // Weeks run Monday to Sunday; getDay() counts from Sunday.
      start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
      end.setTime(start.getTime() + 7 * 86_400_000 - 1);
      return { start, end };
    case 'monthly':
      start.setDate(1);
      end.setTime(new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).getTime());
      return { start, end };
    case 'yearly':
      start.setMonth(0, 1);
      end.setTime(new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999).getTime());
      return { start, end };
    case 'daily':
    default:
      return { start, end };
  }
}

export function computeGoalProgress(
  trades: Trade[],
  metric: GoalMetric,
  period: GoalPeriod,
  target: number,
  now = new Date(),
): GoalProgress {
  const { start, end } = goalWindow(period, now);
  const from = start.toISOString();
  const to = end.toISOString();

  const inWindow = sortClosed(trades).filter(
    (trade) => (trade.closedAt ?? '') >= from && (trade.closedAt ?? '') <= to,
  );

  const stats = computePortfolioStats(inWindow, 0);
  const lowerIsBetter = LOWER_IS_BETTER.includes(metric);

  let current: number | null;
  switch (metric) {
    case 'net_pnl':
      current = inWindow.length === 0 ? null : stats.netPnl;
      break;
    case 'win_rate':
      current = stats.winRate;
      break;
    case 'profit_factor':
      current = stats.profitFactor;
      break;
    case 'trade_count':
      current = inWindow.length;
      break;
    case 'max_risk':
      current = stats.largestLoss === null ? null : Math.abs(stats.largestLoss);
      break;
    case 'discipline': {
      if (inWindow.length === 0) {
        current = null;
        break;
      }
      const withStop = inWindow.filter((t) => t.stopLoss !== null).length;
      current = (withStop / inWindow.length) * 100;
      break;
    }
    default:
      current = null;
  }

  let ratio: number | null = null;
  if (current !== null && target !== 0) {
    // Below a ceiling is full progress; above it, the bar shows how far over.
    ratio = lowerIsBetter
      ? Math.min(1, Math.max(0, current / target))
      : Math.min(1, Math.max(0, current / target));
  }

  const met =
    current === null ? false : lowerIsBetter ? current <= target : current >= target;

  return {
    current,
    target,
    ratio,
    met,
    sampleSize: inWindow.length,
    windowStart: from,
    windowEnd: to,
    lowerIsBetter,
  };
}

/** Trades that closed on one calendar day, for the calendar's day view. */
export function tradesOnDay(trades: Trade[], isoDate: string): Trade[] {
  return sortClosed(trades).filter((trade) => (trade.closedAt ?? '').slice(0, 10) === isoDate);
}

export interface DaySummary {
  date: string;
  netPnl: number;
  trades: number;
  wins: number;
  losses: number;
}

/** One row per day that had a closed trade, keyed by ISO date. */
export function summariseDays(trades: Trade[]): Map<string, DaySummary> {
  const days = new Map<string, DaySummary>();

  for (const trade of sortClosed(trades)) {
    const date = (trade.closedAt ?? '').slice(0, 10);
    const result = computeTradeResult(trade);
    const day = days.get(date) ?? { date, netPnl: 0, trades: 0, wins: 0, losses: 0 };

    day.netPnl += result.netPnl;
    day.trades += 1;
    if (result.isWin) day.wins += 1;
    else if (!result.isScratch) day.losses += 1;

    days.set(date, day);
  }

  return days;
}
