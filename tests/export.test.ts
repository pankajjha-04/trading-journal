import { describe, expect, it } from 'vitest';
import { escapeCell, safeFilename, toCsv, tradesToCsv } from '@/lib/export/csv';
import { parseCsv } from '@/lib/import/csv';
import type { Trade } from '@/lib/types/trade';

function trade(overrides: Partial<Trade> = {}): Trade {
  return {
    id: 'abc', accountId: 'acc', symbol: 'BTCUSDT', market: 'crypto',
    direction: 'long', status: 'closed',
    openedAt: '2025-01-04T09:00:00.000Z', closedAt: '2025-01-04T11:00:00.000Z',
    quantity: 1, contractSize: 1, entryPrice: 100, exitPrice: 110,
    stopLoss: 90, takeProfit: 130, fees: 0, commission: 0, swap: 0,
    strategyId: null, setup: null, timeframe: null, session: null,
    marketCondition: null, emotion: null, confidence: null,
    executionRating: null, notes: null, tags: [], ...overrides,
  };
}

describe('escapeCell', () => {
  it('quotes fields containing commas, quotes or newlines', () => {
    expect(escapeCell('a,b')).toBe('"a,b"');
    expect(escapeCell('say "hi"')).toBe('"say ""hi"""');
    expect(escapeCell('line1\nline2')).toBe('"line1\nline2"');
  });

  it('neutralises formula injection', () => {
    // Without the guard these execute on open in Excel and Sheets.
    expect(escapeCell('=1+1')).toBe('\t=1+1');
    expect(escapeCell('+44 1234')).toBe('\t+44 1234');
    expect(escapeCell('-5')).toBe('\t-5');
    expect(escapeCell('@SUM(A1)')).toBe('\t@SUM(A1)');
  });

  it('renders null and undefined as empty, not as the word', () => {
    expect(escapeCell(null)).toBe('');
    expect(escapeCell(undefined)).toBe('');
  });
});

describe('tradesToCsv', () => {
  it('round-trips through the importer parser', () => {
    const csv = tradesToCsv([
      trade({ notes: 'Broke structure, took the retest', tags: ['smc', 'sweep'] }),
      trade({ id: 'def', symbol: 'ETHUSDT', direction: 'short', notes: 'Had a comma, and "quotes"' }),
    ]);

    const parsed = parseCsv(csv);
    expect(parsed.headers[1]).toBe('Symbol');
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[1]![29]).toBe('Had a comma, and "quotes"');
  });

  it('leaves derived columns empty for open trades rather than writing zero', () => {
    const csv = tradesToCsv([
      trade({ status: 'open', exitPrice: null, closedAt: null }),
    ]);
    const { rows } = parseCsv(csv);
    expect(rows[0]![17]).toBe(''); // Net P&L
    expect(rows[0]![18]).toBe(''); // R multiple
  });

  it('writes computed values for closed trades', () => {
    const { rows } = parseCsv(tradesToCsv([trade()]));
    expect(Number(rows[0]![17])).toBe(10);
    expect(Number(rows[0]![18])).toBe(1);
  });
});

describe('toCsv', () => {
  it('starts with a BOM so Excel reads UTF-8', () => {
    expect(toCsv(['a'], [['é']]).startsWith('\uFEFF')).toBe(true);
  });
});

describe('safeFilename', () => {
  it('strips anything that could confuse a download header', () => {
    expect(safeFilename('My Account / 2025', 'csv')).toMatch(/^my-account-2025-\d{4}-\d{2}-\d{2}\.csv$/);
  });

  it('falls back when the name reduces to nothing', () => {
    expect(safeFilename('///', 'csv')).toMatch(/^export-/);
  });
});
