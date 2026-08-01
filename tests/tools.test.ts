import { describe, expect, it } from 'vitest';
import {
  computePipValue,
  computePositionSize,
  computeReward,
  computeStreak,
  pipSize,
} from '@/lib/metrics/tools';

describe('computePositionSize', () => {
  it('sizes from risk, not from a guess', () => {
    const result = computePositionSize({
      balance: 10_000,
      riskPercent: 1,
      entryPrice: 100,
      stopPrice: 95,
      contractSize: 1,
    });

    expect(result.riskAmount).toBe(100);
    expect(result.stopDistance).toBe(5);
    expect(result.quantity).toBe(20);
    expect(result.notional).toBe(2000);
  });

  it('applies the contract multiplier', () => {
    const result = computePositionSize({
      balance: 10_000,
      riskPercent: 1,
      entryPrice: 2000,
      stopPrice: 1990,
      contractSize: 100,
    });
    expect(result.quantity).toBeCloseTo(0.1, 6);
  });

  it('refuses a zero-width stop instead of returning Infinity', () => {
    const result = computePositionSize({
      balance: 10_000,
      riskPercent: 1,
      entryPrice: 100,
      stopPrice: 100,
      contractSize: 1,
    });
    expect(result.quantity).toBeNull();
    expect(result.reason).toContain('cannot be the same');
  });

  it('refuses a zero balance or zero risk', () => {
    expect(
      computePositionSize({ balance: 0, riskPercent: 1, entryPrice: 100, stopPrice: 95, contractSize: 1 }).quantity,
    ).toBeNull();
    expect(
      computePositionSize({ balance: 100, riskPercent: 0, entryPrice: 100, stopPrice: 95, contractSize: 1 }).quantity,
    ).toBeNull();
  });

  it('works the same for a short, where the stop sits above entry', () => {
    const long = computePositionSize({ balance: 10_000, riskPercent: 1, entryPrice: 100, stopPrice: 95, contractSize: 1 });
    const short = computePositionSize({ balance: 10_000, riskPercent: 1, entryPrice: 100, stopPrice: 105, contractSize: 1 });
    expect(short.quantity).toBe(long.quantity);
  });

  it('reports leverage so an oversized position is visible', () => {
    const result = computePositionSize({
      balance: 1000,
      riskPercent: 1,
      entryPrice: 100,
      stopPrice: 99.9,
      contractSize: 1,
    });
    expect(result.leverage).toBeGreaterThan(9);
  });
});

describe('computeReward', () => {
  it('computes the ratio and the win rate it needs', () => {
    const result = computeReward({ entryPrice: 100, stopPrice: 95, targetPrice: 110 });
    expect(result.ratio).toBe(2);
    expect(result.breakevenWinRate).toBeCloseTo(33.33, 1);
  });

  it('a 1:1 setup needs half your trades to win', () => {
    expect(computeReward({ entryPrice: 100, stopPrice: 95, targetPrice: 105 }).breakevenWinRate).toBe(50);
  });

  it('returns null rather than dividing by a zero stop', () => {
    expect(computeReward({ entryPrice: 100, stopPrice: 100, targetPrice: 110 }).ratio).toBeNull();
  });
});

describe('pip value', () => {
  it('knows a JPY pip is a tenth of the others', () => {
    expect(pipSize('EURUSD')).toBe(0.0001);
    expect(pipSize('usdjpy')).toBe(0.01);
  });

  it('values a standard lot at ten units of the quote currency', () => {
    expect(
      computePipValue({ symbol: 'EURUSD', lots: 1, contractSize: 100_000, quoteRate: 1 }),
    ).toBeCloseTo(10, 6);
  });
});

describe('computeStreak', () => {
  const today = new Date('2026-03-15T12:00:00');

  it('counts back from today', () => {
    const result = computeStreak({
      dates: ['2026-03-13', '2026-03-14', '2026-03-15'],
      today,
    });
    expect(result.current).toBe(3);
  });

  it('does not reset in the morning before today is filled', () => {
    const result = computeStreak({ dates: ['2026-03-13', '2026-03-14'], today });
    expect(result.current).toBe(2);
  });

  it('breaks once a whole day is missed', () => {
    const result = computeStreak({ dates: ['2026-03-10', '2026-03-11'], today });
    expect(result.current).toBe(0);
    expect(result.longest).toBe(2);
  });

  it('finds the longest run anywhere in the history', () => {
    const result = computeStreak({
      dates: ['2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04', '2026-02-01'],
      today,
    });
    expect(result.longest).toBe(4);
    expect(result.total).toBe(5);
  });

  it('ignores duplicates and handles an empty history', () => {
    expect(computeStreak({ dates: ['2026-03-15', '2026-03-15'], today }).total).toBe(1);
    expect(computeStreak({ dates: [], today })).toEqual({ current: 0, longest: 0, total: 0 });
  });
});
