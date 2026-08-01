import type { Trade, TradeResult } from '@/lib/types/trade';

/** Trades within this fraction of breakeven count as scratches, not wins. */
const SCRATCH_EPSILON = 1e-9;

/**
 * Compute every derived value for a single trade.
 *
 * Open trades return zeroed P&L rather than throwing — the caller decides
 * whether to include them (a mark-to-market equity curve does, a win-rate
 * calculation does not).
 */
export function computeTradeResult(trade: Trade): TradeResult {
  const {
    direction,
    quantity,
    contractSize,
    entryPrice,
    exitPrice,
    stopLoss,
    takeProfit,
    fees,
    commission,
    swap,
  } = trade;

  const multiplier = quantity * contractSize;
  const sign = direction === 'long' ? 1 : -1;
  const costs = fees + commission + swap;

  const grossPnl = exitPrice === null ? 0 : (exitPrice - entryPrice) * sign * multiplier;
  const netPnl = exitPrice === null ? 0 : grossPnl - costs;

  const notional = Math.abs(entryPrice * multiplier);
  const returnPct = notional === 0 ? 0 : (netPnl / notional) * 100;

  // Risk is only defined when a stop existed. Inferring it from the realised
  // loss would make every losing trade look like a perfectly executed -1R.
  // Risk is measured in the direction of the trade, not as a distance. A stop
  // that has been trailed past entry has locked in profit — there is no risk
  // left to divide by, so R is undefined rather than inverted.
  const signedRisk =
    stopLoss === null
      ? null
      : direction === 'long'
        ? entryPrice - stopLoss
        : stopLoss - entryPrice;

  const riskAmount = signedRisk === null || signedRisk <= 0 ? null : signedRisk * multiplier;

  const rMultiple =
    riskAmount === null || riskAmount === 0 || exitPrice === null
      ? null
      : netPnl / riskAmount;

  const plannedRr =
    stopLoss === null || takeProfit === null || Math.abs(entryPrice - stopLoss) === 0
      ? null
      : Math.abs(takeProfit - entryPrice) / Math.abs(entryPrice - stopLoss);

  return {
    grossPnl,
    costs,
    netPnl,
    returnPct,
    riskAmount,
    rMultiple,
    plannedRr,
    isWin: netPnl > SCRATCH_EPSILON,
    isScratch: Math.abs(netPnl) <= SCRATCH_EPSILON,
  };
}

export function isClosed(trade: Trade): boolean {
  return trade.status === 'closed' && trade.exitPrice !== null;
}
