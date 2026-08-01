import { describe, expect, it } from 'vitest';
import {
  computeGoalProgress,
  goalWindow,
  summariseDays,
  tradesOnDay,
} from '@/lib/metrics/goals';
import type { Trade } from '@/lib/types/trade';

function trade(overrides: Partial<Trade> = {}): Trade {
  return {
    id: crypto.randomUUID(), accountId: 'a', symbol: 'BTCUSDT', market: 'crypto',
    direction: 'long', status: 'closed',
    openedAt: '2026-03-10T09:00:00.000Z', closedAt: '2026-03-10T11:00:00.000Z',
    quantity: 1, contractSize: 1, entryPrice: 100, exitPrice: 110,
    stopLoss: 90, takeProfit: 130, fees: 0, commission: 0, swap: 0,
    strategyId: null, setup: null, timeframe: null, session: null,
    marketCondition: null, emotion: null, confidence: null,
    executionRating: null, notes: null, tags: [], ...overrides,
  };
}

const NOW = new Date('2026-03-11T15:00:00');

describe('goalWindow', () => {
  it('starts the week on Monday', () => {
    const { start } = goalWindow('weekly', new Date('2026-03-11T15:00:00'));
    expect(start.getDay()).toBe(1);
  });

  it('covers a whole month', () => {
    const { start, end } = goalWindow('monthly', NOW);
    expect(start.getDate()).toBe(1);
    expect(end.getMonth()).toBe(2);
    expect(end.getDate()).toBe(31);
  });

  it('daily is one calendar day', () => {
    const { start, end } = goalWindow('daily', NOW);
    expect(start.getDate()).toBe(end.getDate());
    expect(end.getHours()).toBe(23);
  });
});

describe('computeGoalProgress', () => {
  const inWindow = [
    trade({ closedAt: '2026-03-10T11:00:00.000Z', exitPrice: 110 }),
    trade({ closedAt: '2026-03-11T11:00:00.000Z', exitPrice: 90 }),
  ];

  it('measures net P&L over the window', () => {
    const progress = computeGoalProgress(inWindow, 'net_pnl', 'monthly', 100, NOW);
    expect(progress.current).toBe(0);
    expect(progress.sampleSize).toBe(2);
  });

  it('ignores trades outside the window', () => {
    const outside = [...inWindow, trade({ closedAt: '2026-01-05T11:00:00.000Z' })];
    const progress = computeGoalProgress(outside, 'trade_count', 'monthly', 10, NOW);
    expect(progress.current).toBe(2);
  });

  it('returns null rather than zero when nothing has been traded', () => {
    const progress = computeGoalProgress([], 'net_pnl', 'daily', 500, NOW);
    expect(progress.current).toBeNull();
    expect(progress.ratio).toBeNull();
    expect(progress.met).toBe(false);
  });

  it('treats a max-risk goal as a ceiling, not a target', () => {
    const heavy = [trade({ closedAt: '2026-03-11T11:00:00.000Z', exitPrice: 50 })];
    const progress = computeGoalProgress(heavy, 'max_risk', 'daily', 100, NOW);
    expect(progress.lowerIsBetter).toBe(true);
    expect(progress.current).toBe(50);
    expect(progress.met).toBe(true);
  });

  it('marks a breached ceiling as not met', () => {
    const heavy = [trade({ closedAt: '2026-03-11T11:00:00.000Z', exitPrice: 50 })];
    const progress = computeGoalProgress(heavy, 'max_risk', 'daily', 20, NOW);
    expect(progress.met).toBe(false);
  });

  it('computes stop discipline as a percentage', () => {
    const mixed = [
      trade({ closedAt: '2026-03-11T09:00:00.000Z' }),
      trade({ closedAt: '2026-03-11T10:00:00.000Z', stopLoss: null }),
    ];
    const progress = computeGoalProgress(mixed, 'discipline', 'daily', 100, NOW);
    expect(progress.current).toBe(50);
    expect(progress.met).toBe(false);
  });

  it('caps the ratio at 1 so an overshoot does not overflow the bar', () => {
    const big = [trade({ closedAt: '2026-03-11T11:00:00.000Z', exitPrice: 300 })];
    const progress = computeGoalProgress(big, 'net_pnl', 'daily', 50, NOW);
    expect(progress.ratio).toBe(1);
    expect(progress.met).toBe(true);
  });

  it('leaves profit factor null while nothing has lost', () => {
    const winners = [trade({ closedAt: '2026-03-11T11:00:00.000Z' })];
    expect(computeGoalProgress(winners, 'profit_factor', 'daily', 2, NOW).current).toBeNull();
  });
});

describe('summariseDays', () => {
  it('groups by close date with win and loss counts', () => {
    const days = summariseDays([
      trade({ closedAt: '2026-03-10T09:00:00.000Z', exitPrice: 110 }),
      trade({ closedAt: '2026-03-10T15:00:00.000Z', exitPrice: 90 }),
      trade({ closedAt: '2026-03-11T09:00:00.000Z', exitPrice: 120 }),
    ]);

    expect(days.get('2026-03-10')?.trades).toBe(2);
    expect(days.get('2026-03-10')?.wins).toBe(1);
    expect(days.get('2026-03-10')?.losses).toBe(1);
    expect(days.get('2026-03-11')?.netPnl).toBe(20);
  });

  it('excludes open trades', () => {
    const days = summariseDays([trade({ status: 'open', exitPrice: null, closedAt: null })]);
    expect(days.size).toBe(0);
  });
});

describe('tradesOnDay', () => {
  it('returns only that day', () => {
    const all = [
      trade({ closedAt: '2026-03-10T09:00:00.000Z' }),
      trade({ closedAt: '2026-03-11T09:00:00.000Z' }),
    ];
    expect(tradesOnDay(all, '2026-03-10')).toHaveLength(1);
  });
});

describe('summariseMonth', () => {
  it('finds the best and worst day and the longest runs', async () => {
    const { summariseMonth } = await import('@/components/calendar/month-summary');
    const days = [
      { date: '2026-05-05', netPnl: -18, trades: 2, wins: 0, losses: 2 },
      { date: '2026-05-06', netPnl: -37, trades: 2, wins: 0, losses: 2 },
      { date: '2026-05-07', netPnl: 39, trades: 2, wins: 2, losses: 0 },
      { date: '2026-05-08', netPnl: -52, trades: 4, wins: 1, losses: 3 },
      { date: '2026-05-19', netPnl: 130, trades: 4, wins: 4, losses: 0 },
      { date: '2026-05-20', netPnl: 66, trades: 1, wins: 1, losses: 0 },
    ];

    const totals = summariseMonth(days);
    expect(totals.green).toBe(3);
    expect(totals.red).toBe(3);
    expect(totals.trades).toBe(15);
    expect(totals.best?.date).toBe('2026-05-19');
    expect(totals.worst?.date).toBe('2026-05-08');
    expect(totals.bestStreak).toBe(2);
    expect(totals.worstStreak).toBe(2);
  });

  it('treats a flat day as breaking both runs', async () => {
    const { summariseMonth } = await import('@/components/calendar/month-summary');
    const totals = summariseMonth([
      { date: '2026-05-01', netPnl: 10, trades: 1, wins: 1, losses: 0 },
      { date: '2026-05-02', netPnl: 0, trades: 1, wins: 0, losses: 0 },
      { date: '2026-05-03', netPnl: 10, trades: 1, wins: 1, losses: 0 },
    ]);
    expect(totals.bestStreak).toBe(1);
    expect(totals.green).toBe(2);
  });

  it('handles an empty month', async () => {
    const { summariseMonth } = await import('@/components/calendar/month-summary');
    const totals = summariseMonth([]);
    expect(totals.trades).toBe(0);
    expect(totals.best).toBeNull();
  });
});
