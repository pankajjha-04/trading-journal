import type { Trade } from '@/lib/types/trade';
import { computeTradeResult, isClosed } from './trade';

export interface EquityPoint {
  /** ISO timestamp of the trade that produced this balance. */
  at: string;
  balance: number;
  /** Running peak, used to draw the underwater curve. */
  peak: number;
  drawdown: number;
  drawdownPct: number;
}

export interface PortfolioStats {
  totalTrades: number;
  closedTrades: number;
  openTrades: number;

  wins: number;
  losses: number;
  scratches: number;
  winRate: number | null;
  lossRate: number | null;

  grossProfit: number;
  grossLoss: number;
  totalCosts: number;
  netPnl: number;

  /** Null when there are no losing trades — an infinite profit factor is not a number. */
  profitFactor: number | null;
  /** Mean net P&L per closed trade, in currency. */
  expectancy: number | null;
  /** Mean R-multiple across trades that had a stop. Null when none did. */
  expectancyR: number | null;

  avgWin: number | null;
  avgLoss: number | null;
  avgRr: number | null;
  largestWin: number | null;
  largestLoss: number | null;

  maxConsecutiveWins: number;
  maxConsecutiveLosses: number;

  maxDrawdown: number;
  maxDrawdownPct: number;
  recoveryFactor: number | null;
}

/** Oldest-first ordering by close time; open trades are excluded. */
export function sortClosed(trades: Trade[]): Trade[] {
  return trades
    .filter(isClosed)
    .slice()
    .sort((a, b) => (a.closedAt ?? '').localeCompare(b.closedAt ?? ''));
}

export function buildEquityCurve(trades: Trade[], startingBalance: number): EquityPoint[] {
  let balance = startingBalance;
  let peak = startingBalance;
  const points: EquityPoint[] = [];

  for (const trade of sortClosed(trades)) {
    balance += computeTradeResult(trade).netPnl;
    peak = Math.max(peak, balance);
    const drawdown = peak - balance;
    points.push({
      at: trade.closedAt ?? trade.openedAt,
      balance,
      peak,
      drawdown,
      // Guard against a zero or negative peak, which happens on blown accounts.
      drawdownPct: peak > 0 ? (drawdown / peak) * 100 : 0,
    });
  }

  return points;
}

export function computePortfolioStats(
  trades: Trade[],
  startingBalance = 0,
): PortfolioStats {
  const closed = sortClosed(trades);
  const results = closed.map(computeTradeResult);

  let grossProfit = 0;
  let grossLoss = 0;
  let totalCosts = 0;
  let wins = 0;
  let losses = 0;
  let scratches = 0;
  let largestWin: number | null = null;
  let largestLoss: number | null = null;

  let winStreak = 0;
  let lossStreak = 0;
  let maxConsecutiveWins = 0;
  let maxConsecutiveLosses = 0;

  const rMultiples: number[] = [];
  const rrValues: number[] = [];

  for (const r of results) {
    totalCosts += r.costs;
    if (r.rMultiple !== null) rMultiples.push(r.rMultiple);
    if (r.plannedRr !== null) rrValues.push(r.plannedRr);

    if (r.isScratch) {
      scratches += 1;
      // A scratch breaks both streaks — it is neither a win nor a loss.
      winStreak = 0;
      lossStreak = 0;
      continue;
    }

    if (r.isWin) {
      wins += 1;
      grossProfit += r.netPnl;
      largestWin = largestWin === null ? r.netPnl : Math.max(largestWin, r.netPnl);
      winStreak += 1;
      lossStreak = 0;
      maxConsecutiveWins = Math.max(maxConsecutiveWins, winStreak);
    } else {
      losses += 1;
      grossLoss += Math.abs(r.netPnl);
      largestLoss = largestLoss === null ? r.netPnl : Math.min(largestLoss, r.netPnl);
      lossStreak += 1;
      winStreak = 0;
      maxConsecutiveLosses = Math.max(maxConsecutiveLosses, lossStreak);
    }
  }

  const closedCount = closed.length;
  const decided = wins + losses;
  const netPnl = results.reduce((sum, r) => sum + r.netPnl, 0);

  const curve = buildEquityCurve(trades, startingBalance);
  const maxDrawdown = curve.reduce((max, p) => Math.max(max, p.drawdown), 0);
  const maxDrawdownPct = curve.reduce((max, p) => Math.max(max, p.drawdownPct), 0);

  return {
    totalTrades: trades.length,
    closedTrades: closedCount,
    openTrades: trades.length - closedCount,

    wins,
    losses,
    scratches,
    // Scratches are excluded from the denominator: a breakeven trade should
    // not dilute win rate in either direction.
    winRate: decided === 0 ? null : (wins / decided) * 100,
    lossRate: decided === 0 ? null : (losses / decided) * 100,

    grossProfit,
    grossLoss,
    totalCosts,
    netPnl,

    profitFactor: grossLoss === 0 ? null : grossProfit / grossLoss,
    expectancy: closedCount === 0 ? null : netPnl / closedCount,
    expectancyR: rMultiples.length === 0 ? null : mean(rMultiples),

    avgWin: wins === 0 ? null : grossProfit / wins,
    avgLoss: losses === 0 ? null : -(grossLoss / losses),
    avgRr: rrValues.length === 0 ? null : mean(rrValues),
    largestWin,
    largestLoss,

    maxConsecutiveWins,
    maxConsecutiveLosses,

    maxDrawdown,
    maxDrawdownPct,
    recoveryFactor: maxDrawdown === 0 ? null : netPnl / maxDrawdown,
  };
}

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}
