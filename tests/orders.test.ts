import { describe, expect, it } from 'vitest';
import {
  guessOrderMapping,
  inferMultipliers,
  isFilled,
  reconstruct,
  reconstructPositions,
  toOrderFills,
  type OrderFill,
} from '@/lib/import/orders';

function fill(overrides: Partial<OrderFill> = {}): OrderFill {
  return {
    symbol: 'XAUUSD',
    side: 'long',
    quantity: 1,
    price: 100,
    filledAt: '2026-01-01T09:00:00.000Z',
    netPnl: null,
    externalId: null,
    ...overrides,
  };
}

describe('isFilled', () => {
  it('recognises the words brokers use', () => {
    expect(isFilled('filled')).toBe(true);
    expect(isFilled('Closed')).toBe(true);
    expect(isFilled('EXECUTED')).toBe(true);
    expect(isFilled('cancelled')).toBe(false);
    expect(isFilled('canceled')).toBe(false);
    expect(isFilled('rejected')).toBe(false);
    expect(isFilled('expired')).toBe(false);
  });

  it('assumes fills when no status column exists', () => {
    expect(isFilled(undefined)).toBe(true);
    expect(isFilled('')).toBe(true);
  });
});

describe('reconstructPositions', () => {
  it('pairs an opening fill with its closing fill', () => {
    const { trades, openLots } = reconstructPositions([
      fill({ side: 'short', price: 4044, filledAt: '2026-01-01T09:00:00.000Z' }),
      fill({ side: 'long', price: 4050, filledAt: '2026-01-01T11:00:00.000Z' }),
    ]);

    expect(trades).toHaveLength(1);
    expect(trades[0]!.direction).toBe('short');
    expect(trades[0]!.entryPrice).toBe(4044);
    expect(trades[0]!.exitPrice).toBe(4050);
    expect(openLots).toBe(0);
  });

  it('splits a partial exit into two trades', () => {
    const { trades, openLots } = reconstructPositions([
      fill({ quantity: 1, price: 100, filledAt: '2026-01-01T09:00:00.000Z' }),
      fill({ side: 'short', quantity: 0.4, price: 110, filledAt: '2026-01-01T10:00:00.000Z' }),
      fill({ side: 'short', quantity: 0.6, price: 120, filledAt: '2026-01-01T11:00:00.000Z' }),
    ]);

    expect(trades).toHaveLength(2);
    expect(trades[0]!.quantity).toBeCloseTo(0.4);
    expect(trades[1]!.quantity).toBeCloseTo(0.6);
    expect(openLots).toBe(0);
  });

  it('closes the oldest lot first when scaling in', () => {
    const { trades } = reconstructPositions([
      fill({ price: 100, filledAt: '2026-01-01T09:00:00.000Z' }),
      fill({ price: 200, filledAt: '2026-01-01T10:00:00.000Z' }),
      fill({ side: 'short', quantity: 1, price: 300, filledAt: '2026-01-01T11:00:00.000Z' }),
    ]);

    expect(trades).toHaveLength(1);
    expect(trades[0]!.entryPrice).toBe(100);
  });

  it('leaves an unclosed lot open rather than inventing an exit', () => {
    const { trades, openLots } = reconstructPositions([fill()]);
    expect(trades).toHaveLength(0);
    expect(openLots).toBe(1);
  });

  it('keeps symbols in separate books', () => {
    const { trades, openLots } = reconstructPositions([
      fill({ symbol: 'XAUUSD' }),
      fill({ symbol: 'BTCUSD', side: 'short' }),
    ]);
    expect(trades).toHaveLength(0);
    expect(openLots).toBe(2);
  });

  it('reverses a position: closes the old one and opens the opposite', () => {
    const { trades, openLots } = reconstructPositions([
      fill({ quantity: 1, price: 100 }),
      fill({ side: 'short', quantity: 3, price: 110, filledAt: '2026-01-01T10:00:00.000Z' }),
    ]);

    expect(trades).toHaveLength(1);
    expect(trades[0]!.quantity).toBe(1);
    expect(openLots).toBe(1); // the remaining 2 short
  });

  it('orders fills by time regardless of row order', () => {
    const { trades } = reconstructPositions([
      fill({ side: 'short', price: 110, filledAt: '2026-01-01T11:00:00.000Z' }),
      fill({ price: 100, filledAt: '2026-01-01T09:00:00.000Z' }),
    ]);
    expect(trades[0]!.entryPrice).toBe(100);
  });
});

describe('inferMultipliers', () => {
  it('derives a gold lot of 100 ounces from the reported P&L', () => {
    // Three shorts on 0.1 lots, each moving 6.29 against, each losing 62.90.
    const fills: OrderFill[] = [];
    const closures: { symbol: string; move: number; externalId: string | null }[] = [];

    for (let i = 0; i < 4; i += 1) {
      fills.push(fill({ externalId: `x${i}`, netPnl: -62.9 }));
      closures.push({ symbol: 'XAUUSD', move: -0.629, externalId: `x${i}` });
    }

    expect(inferMultipliers(fills, closures).XAUUSD).toBe(100);
  });

  it('says nothing when there is too little evidence', () => {
    const fills = [fill({ externalId: 'a', netPnl: 10 })];
    const closures = [{ symbol: 'XAUUSD', move: 1, externalId: 'a' }];
    expect(inferMultipliers(fills, closures).XAUUSD).toBeUndefined();
  });

  it('ignores a single wild outlier', () => {
    const fills: OrderFill[] = [];
    const closures: { symbol: string; move: number; externalId: string | null }[] = [];
    for (let i = 0; i < 5; i += 1) {
      const bad = i === 2;
      fills.push(fill({ externalId: `x${i}`, netPnl: bad ? 9999 : 100 }));
      closures.push({ symbol: 'BTCUSD', move: 100, externalId: `x${i}` });
    }
    expect(inferMultipliers(fills, closures).BTCUSD).toBe(1);
  });
});

describe('reconstruct end to end', () => {
  const headers = ['Date', 'Order ID', 'Pair', 'Type', 'Side', 'Lot Size', 'Price', 'Status', 'Net P&L'];
  const mapping = guessOrderMapping(headers);

  const rows = [
    ['2026-01-01T09:00:00Z', '1', 'XAU/USD', 'market', 'sell', '0.100', '4044.40', 'filled', ''],
    ['2026-01-01T09:00:01Z', '2', 'XAU/USD', 'stop_loss', 'buy', '0.100', '4050.00', 'cancelled', ''],
    ['2026-01-01T11:00:00Z', '3', 'XAU/USD', 'stop_loss', 'buy', '0.100', '4046.91', 'filled', '-25.10'],
  ];

  it('maps the columns a broker order export actually uses', () => {
    expect(mapping.symbol).toBe(2);
    expect(mapping.side).toBe(4);
    expect(mapping.quantity).toBe(5);
    expect(mapping.status).toBe(7);
    expect(mapping.netPnl).toBe(8);
  });

  it('drops cancelled orders and rebuilds one trade', () => {
    const result = reconstruct(rows, mapping);
    expect(result.skippedOrders).toBe(1);
    expect(result.filledOrders).toBe(2);
    expect(result.trades).toHaveLength(1);
    expect(result.trades[0]!.direction).toBe('short');
    expect(result.openLots).toBe(0);
  });

  it('reports both P&L figures so the numbers can be checked', () => {
    const result = reconstruct(rows, mapping);
    expect(result.reportedPnl).toBeCloseTo(-25.1, 2);
    expect(result.computedPnl).not.toBeNull();
  });

  it('skips rows it cannot read rather than importing them wrong', () => {
    const broken = [['not-a-date', '9', '', 'market', 'sideways', 'abc', 'xyz', 'filled', '']];
    const result = reconstruct(broken, mapping);
    expect(result.trades).toHaveLength(0);
    expect(result.skippedOrders).toBe(1);
  });
});

describe('toOrderFills', () => {
  it('treats a missing status column as all fills', () => {
    const mapping = guessOrderMapping(['Pair', 'Side', 'Qty', 'Price', 'Time']);
    const { fills, skipped } = toOrderFills(
      [['XAUUSD', 'buy', '1', '100', '2026-01-01T09:00:00Z']],
      mapping,
    );
    expect(fills).toHaveLength(1);
    expect(skipped).toBe(0);
  });
});
