import { describe, expect, it } from 'vitest';
import type { Trade } from '@/lib/types/trade';
import {
  breakdownBy,
  dailyPnl,
  rDistribution,
  resolvePeriod,
  tradesInPeriod,
  MIN_SAMPLE,
} from '@/lib/metrics/breakdown';

function trade(overrides: Partial<Trade> = {}): Trade {
  return {
    id: crypto.randomUUID(),
    accountId: 'acc',
    symbol: 'BTCUSDT',
    market: 'crypto',
    direction: 'long',
    status: 'closed',
    openedAt: '2025-01-06T09:00:00Z',
    closedAt: '2025-01-06T11:00:00Z',
    quantity: 1,
    contractSize: 1,
    entryPrice: 100,
    exitPrice: 110,
    stopLoss: 90,
    takeProfit: 130,
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

describe('breakdownBy', () => {
  it('groups by setup and ranks by net P&L', () => {
    const rows = breakdownBy(
      [
        trade({ setup: 'Order block', exitPrice: 110 }),
        trade({ setup: 'Order block', exitPrice: 120 }),
        trade({ setup: 'Breaker', exitPrice: 95 }),
      ],
      'setup',
    );

    expect(rows.map((r) => r.label)).toEqual(['Order block', 'Breaker']);
    expect(rows[0]!.stats.netPnl).toBe(30);
    expect(rows[1]!.stats.netPnl).toBe(-5);
  });

  it('keeps unrecorded values as their own group instead of dropping them', () => {
    const rows = breakdownBy([trade({ setup: null }), trade({ setup: 'FVG' })], 'setup');
    expect(rows.some((r) => r.label === 'Not recorded')).toBe(true);
  });

  it('flags small groups as unreliable', () => {
    const few = breakdownBy([trade({ setup: 'Sweep' })], 'setup');
    expect(few[0]!.reliable).toBe(false);

    const many = breakdownBy(
      Array.from({ length: MIN_SAMPLE }, () => trade({ setup: 'Sweep' })),
      'setup',
    );
    expect(many[0]!.reliable).toBe(true);
  });

  it('keeps ordered dimensions in order, not ranked by profit', () => {
    const rows = breakdownBy(
      [
        trade({ closedAt: '2025-01-08T11:00:00Z', exitPrice: 200 }), // Wednesday
        trade({ closedAt: '2025-01-06T11:00:00Z', exitPrice: 105 }), // Monday
      ],
      'weekday',
    );
    expect(rows[0]!.key).toBe('1');
    expect(rows[1]!.key).toBe('3');
  });

  it('excludes open trades from every group', () => {
    const rows = breakdownBy(
      [
        trade({ setup: 'FVG' }),
        trade({ setup: 'FVG', status: 'open', exitPrice: null, closedAt: null }),
      ],
      'setup',
    );
    expect(rows[0]!.stats.closedTrades).toBe(1);
  });

  it('buckets R-multiples into ranges', () => {
    const rows = breakdownBy(
      [
        trade({ exitPrice: 130 }), // +3R
        trade({ exitPrice: 90 }), // -1R
      ],
      'rMultiple',
    );
    const labels = rows.map((r) => r.label);
    expect(labels).toContain('3R and above');
    expect(labels).toContain('−2R to 0');
  });
});

describe('dailyPnl', () => {
  it('sums trades per calendar day, oldest first', () => {
    const cells = dailyPnl([
      trade({ closedAt: '2025-01-07T11:00:00Z', exitPrice: 110 }),
      trade({ closedAt: '2025-01-06T11:00:00Z', exitPrice: 120 }),
      trade({ closedAt: '2025-01-06T15:00:00Z', exitPrice: 90 }),
    ]);

    expect(cells.map((c) => c.date)).toEqual(['2025-01-06', '2025-01-07']);
    expect(cells[0]!.netPnl).toBe(10);
    expect(cells[0]!.trades).toBe(2);
  });

  it('returns nothing for an empty account', () => {
    expect(dailyPnl([])).toEqual([]);
  });
});

describe('rDistribution', () => {
  it('skips trades that had no stop instead of counting them as zero', () => {
    const buckets = rDistribution([
      trade({ stopLoss: null }),
      trade({ exitPrice: 110 }), // +1R
    ]);
    const total = buckets.reduce((sum, b) => sum + b.count, 0);
    expect(total).toBe(1);
  });

  it('places extremes in the end buckets', () => {
    const buckets = rDistribution([
      trade({ exitPrice: 60 }), // -4R
      trade({ exitPrice: 200 }), // +10R
    ]);
    expect(buckets[0]!.count).toBe(1);
    expect(buckets[buckets.length - 1]!.count).toBe(1);
  });
});

describe('period filtering', () => {
  it('assigns a trade to the period it closed in, not the one it opened in', () => {
    const period = resolvePeriod('month', new Date('2025-04-15T12:00:00'));
    const spanning = trade({
      openedAt: '2025-03-28T09:00:00.000Z',
      closedAt: '2025-04-02T09:00:00.000Z',
    });
    expect(tradesInPeriod([spanning], period)).toHaveLength(1);
  });

  it('excludes open trades from every period', () => {
    const period = resolvePeriod('all');
    const open = trade({ status: 'open', exitPrice: null, closedAt: null });
    expect(tradesInPeriod([open], period)).toHaveLength(0);
  });

  it('starts the week on Monday', () => {
    const wednesday = new Date('2025-01-08T12:00:00');
    const period = resolvePeriod('week', wednesday);
    expect(new Date(period.from).getDay()).toBe(1);
  });

  it('resolves last month to a closed range', () => {
    const period = resolvePeriod('last-month', new Date('2025-03-10T12:00:00'));
    expect(new Date(period.from).getMonth()).toBe(1);
    expect(new Date(period.to).getMonth()).toBe(1);
  });
});
