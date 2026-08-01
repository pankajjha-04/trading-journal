import { describe, expect, it } from 'vitest';
import type { Trade } from '@/lib/types/trade';
import { computeTradeResult } from '@/lib/metrics/trade';
import { buildEquityCurve, computePortfolioStats } from '@/lib/metrics/portfolio';
import { computeRiskRatios, stdDev, downsideDeviation } from '@/lib/metrics/risk';

function trade(overrides: Partial<Trade> = {}): Trade {
  return {
    id: crypto.randomUUID(),
    accountId: 'acc',
    symbol: 'BTCUSDT',
    market: 'crypto',
    direction: 'long',
    status: 'closed',
    openedAt: '2025-01-01T09:00:00Z',
    closedAt: '2025-01-01T11:00:00Z',
    quantity: 1,
    contractSize: 1,
    entryPrice: 100,
    exitPrice: 110,
    stopLoss: 95,
    takeProfit: 120,
    fees: 0,
    commission: 0,
    swap: 0,
    strategyId: null,
    setup: null,
    timeframe: null,
    session: null,
    marketCondition: null,
    emotion: null,
    confidence: null,
    executionRating: null,
    notes: null,
    tags: [],
    ...overrides,
  };
}

describe('computeTradeResult', () => {
  it('prices a long correctly', () => {
    const r = computeTradeResult(trade());
    expect(r.grossPnl).toBe(10);
    expect(r.netPnl).toBe(10);
    expect(r.rMultiple).toBe(2);
    expect(r.plannedRr).toBe(4);
    expect(r.isWin).toBe(true);
  });

  it('inverts the sign for a short', () => {
    const r = computeTradeResult(
      trade({ direction: 'short', entryPrice: 110, exitPrice: 100, stopLoss: 115 }),
    );
    expect(r.grossPnl).toBe(10);
    expect(r.rMultiple).toBe(2);
  });

  it('subtracts costs from R-multiple, not just from P&L', () => {
    const r = computeTradeResult(trade({ fees: 2, commission: 1, swap: 0.5 }));
    expect(r.costs).toBe(3.5);
    expect(r.netPnl).toBe(6.5);
    expect(r.rMultiple).toBe(1.3);
  });

  it('applies the contract multiplier for futures', () => {
    const r = computeTradeResult(
      trade({ market: 'futures', symbol: 'ES', contractSize: 50, quantity: 2, entryPrice: 5000, exitPrice: 5010, stopLoss: null }),
    );
    expect(r.grossPnl).toBe(1000);
    expect(r.riskAmount).toBeNull();
    expect(r.rMultiple).toBeNull();
  });

  it('returns null risk rather than inferring it when no stop was set', () => {
    const r = computeTradeResult(trade({ stopLoss: null }));
    expect(r.riskAmount).toBeNull();
    expect(r.rMultiple).toBeNull();
    expect(r.plannedRr).toBeNull();
  });

  it('treats a zero-width stop as undefined risk instead of dividing by zero', () => {
    const r = computeTradeResult(trade({ stopLoss: 100 }));
    expect(r.rMultiple).toBeNull();
    expect(Number.isFinite(r.netPnl)).toBe(true);
  });

  it('reports zero P&L for an open position', () => {
    const r = computeTradeResult(trade({ status: 'open', exitPrice: null, closedAt: null }));
    expect(r.netPnl).toBe(0);
    expect(r.isWin).toBe(false);
  });

  it('classifies an exact breakeven as a scratch, not a loss', () => {
    const r = computeTradeResult(trade({ exitPrice: 100 }));
    expect(r.isScratch).toBe(true);
    expect(r.isWin).toBe(false);
  });
});

describe('computePortfolioStats', () => {
  it('returns nulls instead of NaN on an empty account', () => {
    const s = computePortfolioStats([], 10_000);
    expect(s.winRate).toBeNull();
    expect(s.profitFactor).toBeNull();
    expect(s.expectancy).toBeNull();
    expect(s.maxDrawdown).toBe(0);
    expect(s.netPnl).toBe(0);
  });

  it('excludes open trades from win rate', () => {
    const s = computePortfolioStats([
      trade({ exitPrice: 110 }),
      trade({ status: 'open', exitPrice: null, closedAt: null }),
    ]);
    expect(s.closedTrades).toBe(1);
    expect(s.openTrades).toBe(1);
    expect(s.winRate).toBe(100);
  });

  it('excludes scratches from the win-rate denominator', () => {
    const s = computePortfolioStats([
      trade({ exitPrice: 110 }),
      trade({ exitPrice: 90 }),
      trade({ exitPrice: 100 }),
    ]);
    expect(s.scratches).toBe(1);
    expect(s.winRate).toBe(50);
  });

  it('returns null profit factor when nothing has lost yet', () => {
    const s = computePortfolioStats([trade({ exitPrice: 110 }), trade({ exitPrice: 120 })]);
    expect(s.profitFactor).toBeNull();
    expect(s.avgLoss).toBeNull();
  });

  it('tracks streaks and breaks them on a scratch', () => {
    const s = computePortfolioStats([
      trade({ exitPrice: 110, closedAt: '2025-01-01T10:00:00Z' }),
      trade({ exitPrice: 110, closedAt: '2025-01-02T10:00:00Z' }),
      trade({ exitPrice: 100, closedAt: '2025-01-03T10:00:00Z' }),
      trade({ exitPrice: 110, closedAt: '2025-01-04T10:00:00Z' }),
      trade({ exitPrice: 90, closedAt: '2025-01-05T10:00:00Z' }),
      trade({ exitPrice: 90, closedAt: '2025-01-06T10:00:00Z' }),
      trade({ exitPrice: 90, closedAt: '2025-01-07T10:00:00Z' }),
    ]);
    expect(s.maxConsecutiveWins).toBe(2);
    expect(s.maxConsecutiveLosses).toBe(3);
  });

  it('measures drawdown peak-to-trough, not first-to-last', () => {
    const s = computePortfolioStats(
      [
        trade({ exitPrice: 200, closedAt: '2025-01-01T10:00:00Z' }), // +100 → 1100
        trade({ exitPrice: 50, closedAt: '2025-01-02T10:00:00Z' }), // −50  → 1050
        trade({ exitPrice: 60, closedAt: '2025-01-03T10:00:00Z' }), // −40  → 1010
        trade({ exitPrice: 130, closedAt: '2025-01-04T10:00:00Z' }), // +30  → 1040
      ],
      1000,
    );
    expect(s.maxDrawdown).toBe(90);
    expect(s.maxDrawdownPct).toBeCloseTo(8.1818, 3);
  });
});

describe('buildEquityCurve', () => {
  it('orders by close time regardless of input order', () => {
    const curve = buildEquityCurve(
      [
        trade({ exitPrice: 110, closedAt: '2025-03-01T10:00:00Z' }),
        trade({ exitPrice: 120, closedAt: '2025-01-01T10:00:00Z' }),
      ],
      1000,
    );
    expect(curve.map((p) => p.balance)).toEqual([1020, 1030]);
  });
});

describe('risk ratios', () => {
  it('withholds ratios below a usable sample size', () => {
    const trades = Array.from({ length: 5 }, (_, i) =>
      trade({ closedAt: `2025-01-0${i + 1}T10:00:00Z` }),
    );
    const r = computeRiskRatios(trades, 10_000);
    expect(r.sharpe).toBeNull();
    expect(r.sampleSize).toBe(5);
  });

  it('computes ratios once enough days exist', () => {
    const trades = Array.from({ length: 40 }, (_, i) => {
      const day = String((i % 28) + 1).padStart(2, '0');
      const month = i < 28 ? '01' : '02';
      return trade({
        exitPrice: i % 3 === 0 ? 90 : 110,
        closedAt: `2025-${month}-${day}T10:00:00Z`,
      });
    });
    const r = computeRiskRatios(trades, 10_000);
    expect(r.sharpe).not.toBeNull();
    expect(Number.isFinite(r.sharpe as number)).toBe(true);
    expect(r.volatility).toBeGreaterThan(0);
  });

  it('never divides by a zero-variance series', () => {
    expect(stdDev([1, 1, 1])).toBe(0);
    expect(stdDev([1])).toBeNull();
    expect(downsideDeviation([0.01, 0.02, 0.03])).toBe(0);
  });

  it('refuses to compute returns on a zero starting balance', () => {
    expect(computeRiskRatios([trade()], 0).sampleSize).toBe(0);
  });
});

describe('a stop trailed past entry', () => {
  it('leaves R undefined rather than inverting it', () => {
    // A long whose stop was moved above entry has locked in profit; there is
    // no risk left to divide by.
    const result = computeTradeResult(
      trade({ direction: 'long', entryPrice: 100, stopLoss: 105, exitPrice: 110 }),
    );
    expect(result.riskAmount).toBeNull();
    expect(result.rMultiple).toBeNull();
    expect(result.netPnl).toBeCloseTo(10, 6);
  });

  it('does the same for a short', () => {
    const result = computeTradeResult(
      trade({ direction: 'short', entryPrice: 100, stopLoss: 95, exitPrice: 90 }),
    );
    expect(result.riskAmount).toBeNull();
    expect(result.rMultiple).toBeNull();
  });

  it('still computes R from a stop on the correct side', () => {
    const result = computeTradeResult(
      trade({ direction: 'long', entryPrice: 100, stopLoss: 90, exitPrice: 120 }),
    );
    expect(result.riskAmount).toBeCloseTo(10, 6);
    expect(result.rMultiple).toBeCloseTo(2, 6);
  });
});
