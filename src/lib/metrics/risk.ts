import type { Trade } from '@/lib/types/trade';
import { computeTradeResult } from './trade';
import { sortClosed, mean } from './portfolio';

/** Trading days per year. Crypto desks should pass 365. */
export const DEFAULT_PERIODS_PER_YEAR = 252;

export interface RiskRatios {
  sharpe: number | null;
  sortino: number | null;
  calmar: number | null;
  /** Standard deviation of daily returns, annualised, as a percentage. */
  volatility: number | null;
  /** Compound annual growth rate implied by the sample, as a percentage. */
  cagr: number | null;
  sampleSize: number;
}

export interface DailyReturn {
  date: string;
  pnl: number;
  balance: number;
  /** Simple return on the previous day's closing balance. */
  ret: number;
}

/**
 * Collapse trades into one row per calendar day of the account's balance.
 * Ratios computed per-trade are not comparable across traders with different
 * frequencies, so everything downstream works off daily returns.
 */
export function buildDailyReturns(trades: Trade[], startingBalance: number): DailyReturn[] {
  if (startingBalance <= 0) return [];

  const byDay = new Map<string, number>();
  for (const trade of sortClosed(trades)) {
    const day = (trade.closedAt ?? trade.openedAt).slice(0, 10);
    byDay.set(day, (byDay.get(day) ?? 0) + computeTradeResult(trade).netPnl);
  }

  let balance = startingBalance;
  const rows: DailyReturn[] = [];

  for (const day of [...byDay.keys()].sort()) {
    const pnl = byDay.get(day) ?? 0;
    const previous = balance;
    balance += pnl;
    rows.push({
      date: day,
      pnl,
      balance,
      ret: previous > 0 ? pnl / previous : 0,
    });
  }

  return rows;
}

/** Sample standard deviation (n−1). Returns null below two observations. */
export function stdDev(values: number[]): number | null {
  if (values.length < 2) return null;
  const avg = mean(values);
  const variance =
    values.reduce((sum, v) => sum + (v - avg) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

/** Downside deviation against a target return — the Sortino denominator. */
export function downsideDeviation(values: number[], target = 0): number | null {
  if (values.length < 2) return null;
  const squared = values.reduce((sum, v) => sum + Math.min(0, v - target) ** 2, 0);
  return Math.sqrt(squared / (values.length - 1));
}

export function computeRiskRatios(
  trades: Trade[],
  startingBalance: number,
  options: { riskFreeRate?: number; periodsPerYear?: number } = {},
): RiskRatios {
  const periods = options.periodsPerYear ?? DEFAULT_PERIODS_PER_YEAR;
  const annualRiskFree = options.riskFreeRate ?? 0;
  const rows = buildDailyReturns(trades, startingBalance);
  const returns = rows.map((r) => r.ret);

  const empty: RiskRatios = {
    sharpe: null,
    sortino: null,
    calmar: null,
    volatility: null,
    cagr: null,
    sampleSize: returns.length,
  };

  // Fewer than 20 daily observations produces ratios that swing wildly with a
  // single trade. Reporting them would be worse than reporting nothing.
  if (returns.length < 20) return empty;

  const periodRiskFree = annualRiskFree / periods;
  const excess = returns.map((r) => r - periodRiskFree);
  const sd = stdDev(returns);
  const dd = downsideDeviation(returns, periodRiskFree);
  const meanExcess = mean(excess);

  const sharpe = sd === null || sd === 0 ? null : (meanExcess / sd) * Math.sqrt(periods);
  const sortino = dd === null || dd === 0 ? null : (meanExcess / dd) * Math.sqrt(periods);
  const volatility = sd === null ? null : sd * Math.sqrt(periods) * 100;

  const finalBalance = rows[rows.length - 1]?.balance ?? startingBalance;
  const years = rows.length / periods;
  const cagr =
    finalBalance <= 0 || years <= 0
      ? null
      : ((finalBalance / startingBalance) ** (1 / years) - 1) * 100;

  const peakToTrough = maxDrawdownPctOf(rows, startingBalance);
  const calmar = cagr === null || peakToTrough === 0 ? null : cagr / peakToTrough;

  return { sharpe, sortino, calmar, volatility, cagr, sampleSize: returns.length };
}

function maxDrawdownPctOf(rows: DailyReturn[], startingBalance: number): number {
  let peak = startingBalance;
  let worst = 0;
  for (const row of rows) {
    peak = Math.max(peak, row.balance);
    if (peak > 0) worst = Math.max(worst, ((peak - row.balance) / peak) * 100);
  }
  return worst;
}
