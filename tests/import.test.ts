import { describe, expect, it } from 'vitest';
import { detectDelimiter, parseCsv } from '@/lib/import/csv';
import { guessMapping, mapRow, parseDate, parseDirection, parseNumber } from '@/lib/import/map';

describe('parseCsv', () => {
  it('keeps delimiters that sit inside quoted fields', () => {
    const { headers, rows } = parseCsv('a,b\n"one, two",three');
    expect(headers).toEqual(['a', 'b']);
    expect(rows[0]).toEqual(['one, two', 'three']);
  });

  it('unescapes doubled quotes', () => {
    const { rows } = parseCsv('a\n"he said ""hi"""');
    expect(rows[0]![0]).toBe('he said "hi"');
  });

  it('handles CRLF and drops blank lines', () => {
    const { rows } = parseCsv('a,b\r\n1,2\r\n\r\n3,4\r\n');
    expect(rows).toEqual([['1', '2'], ['3', '4']]);
  });

  it('detects semicolon files that contain decimal commas', () => {
    expect(detectDelimiter('a;b;c\n1,5;2,5;3,5\n2,5;3,5;4,5')).toBe(';');
  });

  it('detects tabs', () => {
    expect(detectDelimiter('a\tb\n1\t2')).toBe('\t');
  });
});

describe('parseNumber', () => {
  it('strips thousands separators', () => {
    expect(parseNumber('1,234.56')).toBe(1234.56);
  });

  it('reads European decimal commas', () => {
    expect(parseNumber('1.234,56')).toBe(1234.56);
    expect(parseNumber('12,5')).toBe(12.5);
  });

  it('treats a three-digit group after a comma as thousands', () => {
    expect(parseNumber('1,234')).toBe(1234);
  });

  it('reads accounting negatives', () => {
    expect(parseNumber('(12.50)')).toBe(-12.5);
  });

  it('strips currency symbols', () => {
    expect(parseNumber('$1,000.00')).toBe(1000);
  });

  it('returns null for empty and unparseable values, never NaN', () => {
    expect(parseNumber('')).toBeNull();
    expect(parseNumber('  ')).toBeNull();
    expect(parseNumber(undefined)).toBeNull();
    expect(parseNumber('abc')).toBeNull();
  });
});

describe('parseDate', () => {
  it('reads ISO with a zone as an absolute instant', () => {
    expect(parseDate('2025-01-04T09:30:00Z')).toBe('2025-01-04T09:30:00.000Z');
  });

  it('reads MT5 dotted format', () => {
    expect(parseDate('2025.01.04 09:30:00')).not.toBeNull();
  });

  it('respects the day-first choice', () => {
    const dayFirst = parseDate('02/03/2025', true);
    const monthFirst = parseDate('02/03/2025', false);
    expect(new Date(dayFirst!).getMonth()).toBe(2);
    expect(new Date(monthFirst!).getMonth()).toBe(1);
  });

  it('reads unix seconds and milliseconds', () => {
    expect(parseDate('1735986600')).toBe('2025-01-04T10:30:00.000Z');
    expect(parseDate('1735986600000')).toBe('2025-01-04T10:30:00.000Z');
  });

  it('rejects an impossible month instead of guessing', () => {
    expect(parseDate('25/25/2025', true)).toBeNull();
  });

  it('returns null for blanks', () => {
    expect(parseDate('')).toBeNull();
    expect(parseDate(undefined)).toBeNull();
  });
});

describe('parseDirection', () => {
  it('reads the words brokers actually use', () => {
    expect(parseDirection('BUY')).toBe('long');
    expect(parseDirection('Sell')).toBe('short');
    expect(parseDirection('Long')).toBe('long');
    expect(parseDirection('Open Short')).toBe('short');
  });

  it('returns null when it cannot tell', () => {
    expect(parseDirection('unknown')).toBeNull();
    expect(parseDirection('')).toBeNull();
  });
});

describe('guessMapping', () => {
  it('prefers exact matches so close price does not steal entry price', () => {
    const mapping = guessMapping(['Symbol', 'Side', 'Price', 'Close Price', 'Qty', 'Time']);
    expect(mapping.entryPrice).toBe(2);
    expect(mapping.exitPrice).toBe(3);
  });

  it('never assigns one column to two fields', () => {
    const mapping = guessMapping(['Symbol', 'Side', 'Price', 'Qty', 'Time']);
    const used = Object.values(mapping);
    expect(new Set(used).size).toBe(used.length);
  });
});

describe('mapRow', () => {
  const headers = ['Symbol', 'Side', 'Qty', 'Price', 'Close Price', 'Open Time', 'Close Time'];
  const mapping = guessMapping(headers);

  it('marks a row closed only when exit price and close time both parse', () => {
    const closed = mapRow(
      ['BTCUSDT', 'BUY', '0.5', '40000', '41000', '2025-01-04T09:00:00Z', '2025-01-04T11:00:00Z'],
      mapping,
      0,
    );
    expect(closed.values.status).toBe('closed');

    const partial = mapRow(
      ['BTCUSDT', 'BUY', '0.5', '40000', '', '2025-01-04T09:00:00Z', ''],
      mapping,
      1,
    );
    expect(partial.values.status).toBe('open');
    expect(partial.values.exitPrice).toBeNull();
    expect(partial.values.closedAt).toBeNull();
  });

  it('uppercases the symbol and defaults costs to zero', () => {
    const row = mapRow(['btcusdt', 'sell', '1', '100', '', '2025-01-04T09:00:00Z', ''], mapping, 0);
    expect(row.values.symbol).toBe('BTCUSDT');
    expect(row.values.direction).toBe('short');
    expect(row.values.fees).toBe(0);
  });
});

describe('isSpreadsheet', () => {
  it('recognises the formats a trader actually exports', async () => {
    const { isSpreadsheet } = await import('@/lib/import/spreadsheet');
    const make = (name: string, type = '') =>
      new File(['x'], name, { type });

    expect(isSpreadsheet(make('trades.csv', 'text/csv'))).toBe(true);
    expect(isSpreadsheet(make('report.XLSX'))).toBe(true);
    expect(isSpreadsheet(make('old.xls'))).toBe(true);
    expect(isSpreadsheet(make('data.tsv'))).toBe(true);
    expect(isSpreadsheet(make('statement.pdf', 'application/pdf'))).toBe(false);
    expect(isSpreadsheet(make('chart.png', 'image/png'))).toBe(false);
  });
});

describe('broker header variants', () => {
  it('maps an MT5 export that writes "closing" rather than "close"', async () => {
    const { guessMapping, REQUIRED_FIELDS } = await import('@/lib/import/map');
    const headers = [
      'ticket', 'opening_time_utc', 'closing_time_utc', 'type', 'lots',
      'original_position_size', 'symbol', 'opening_price', 'closing_price',
      'stop_loss', 'take_profit', 'commission', 'swap', 'profit', 'equity',
      'margin_level', 'close_reason',
    ];

    const mapping = guessMapping(headers);

    // The bug this covers: "close" is not a substring of "closing", so the
    // exit price and close time were silently unmapped and every finished
    // trade imported as still open.
    expect(headers[mapping.exitPrice!]).toBe('closing_price');
    expect(headers[mapping.closedAt!]).toBe('closing_time_utc');
    expect(headers[mapping.entryPrice!]).toBe('opening_price');
    expect(headers[mapping.openedAt!]).toBe('opening_time_utc');
    expect(headers[mapping.quantity!]).toBe('lots');
    expect(headers[mapping.externalId!]).toBe('ticket');

    expect(REQUIRED_FIELDS.filter((field) => mapping[field] === undefined)).toEqual([]);
  });

  it('still maps the shorter spellings', async () => {
    const { guessMapping } = await import('@/lib/import/map');
    const headers = ['Symbol', 'Side', 'Qty', 'Open Price', 'Close Price', 'Open Time', 'Close Time'];
    const mapping = guessMapping(headers);

    expect(headers[mapping.entryPrice!]).toBe('Open Price');
    expect(headers[mapping.exitPrice!]).toBe('Close Price');
    expect(headers[mapping.closedAt!]).toBe('Close Time');
  });
});

describe('inferContractSizes', () => {
  const headers = ['symbol', 'type', 'lots', 'opening_price', 'closing_price', 'profit'];

  function rowsFor(symbol: string, count: number, size: number) {
    return Array.from({ length: count }, (_, i) => {
      const entry = 100 + i;
      const exit = entry + 2;
      const profit = (exit - entry) * 0.5 * size;
      return [symbol, 'buy', '0.5', String(entry), String(exit), profit.toFixed(2)];
    });
  }

  it('works out a different multiplier for each symbol in one file', async () => {
    const { guessMapping, inferContractSizes } = await import('@/lib/import/map');
    const mapping = guessMapping(headers);

    const sizes = inferContractSizes(
      [...rowsFor('XAUUSD', 6, 100), ...rowsFor('BTCUSD', 5, 1), ...rowsFor('EURUSD', 4, 100_000)],
      mapping,
    );

    // A single account routinely mixes all three. Assuming one value makes
    // every number in the journal wrong.
    expect(sizes).toEqual({ XAUUSD: 100, BTCUSD: 1, EURUSD: 100_000 });
  });

  it('says nothing when the sample is too small to be sure', async () => {
    const { guessMapping, inferContractSizes } = await import('@/lib/import/map');
    const sizes = inferContractSizes(rowsFor('XAGUSD', 2, 5000), guessMapping(headers));
    expect(sizes.XAGUSD).toBeUndefined();
  });

  it('returns nothing at all when no P&L column was mapped', async () => {
    const { guessMapping, inferContractSizes } = await import('@/lib/import/map');
    const without = ['symbol', 'type', 'lots', 'opening_price', 'closing_price'];
    expect(inferContractSizes(rowsFor('XAUUSD', 6, 100), guessMapping(without))).toEqual({});
  });

  it('ignores rows whose P&L disagrees with the price movement', async () => {
    const { guessMapping, inferContractSizes } = await import('@/lib/import/map');
    const rows = [
      ...rowsFor('XAUUSD', 5, 100),
      ['XAUUSD', 'buy', '0.5', '100', '102', '-500'],
    ];
    expect(inferContractSizes(rows, guessMapping(headers)).XAUUSD).toBe(100);
  });
});
