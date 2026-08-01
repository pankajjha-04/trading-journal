import { normaliseHeader } from './csv';

/** Every field an import can fill. Anything not here is ignored. */
export const IMPORT_FIELDS = [
  'symbol',
  'direction',
  'openedAt',
  'closedAt',
  'quantity',
  'contractSize',
  'entryPrice',
  'exitPrice',
  'stopLoss',
  'takeProfit',
  'fees',
  'commission',
  'swap',
  'setup',
  'timeframe',
  'notes',
  'externalId',
  'netPnl',
] as const;

export type ImportField = (typeof IMPORT_FIELDS)[number];

export const FIELD_LABELS: Record<ImportField, string> = {
  symbol: 'Symbol',
  direction: 'Direction',
  openedAt: 'Open time',
  closedAt: 'Close time',
  quantity: 'Quantity',
  contractSize: 'Contract size',
  entryPrice: 'Entry price',
  exitPrice: 'Exit price',
  stopLoss: 'Stop loss',
  takeProfit: 'Take profit',
  fees: 'Fees',
  commission: 'Commission',
  swap: 'Swap or funding',
  setup: 'Setup',
  timeframe: 'Timeframe',
  notes: 'Notes',
  externalId: 'Order ID',
  netPnl: 'Realised P&L',
};

export const REQUIRED_FIELDS: ImportField[] = [
  'symbol',
  'direction',
  'openedAt',
  'quantity',
  'entryPrice',
];

/** Header aliases seen across common broker and exchange exports. */
const ALIASES: Record<ImportField, string[]> = {
  symbol: ['symbol', 'pair', 'instrument', 'ticker', 'market', 'contract'],
  direction: ['direction', 'side', 'type', 'buysell', 'position', 'ordertype'],
  // Brokers write the same idea five ways: open/opened/opening, close/closed/
  // closing. Matching is substring-based, and "close" does not occur inside
  // "closing" — so every stem needs listing explicitly. Missing one silently
  // drops the exit and turns finished trades into open ones.
  openedAt: [
    'opentime', 'openedat', 'openingtime', 'entrytime', 'opendate', 'openingdate',
    'time', 'date', 'datetime', 'createtime',
  ],
  closedAt: [
    'closetime', 'closedat', 'closingtime', 'exittime', 'closedate', 'closingdate',
    'updatetime',
  ],
  quantity: ['quantity', 'qty', 'size', 'volume', 'lots', 'amount', 'filledqty', 'executedqty'],
  contractSize: ['contractsize', 'multiplier', 'lotsize'],
  entryPrice: [
    'entryprice', 'openprice', 'openingprice', 'entry', 'avgprice', 'averageprice', 'price',
  ],
  exitPrice: [
    'exitprice', 'closeprice', 'closingprice', 'exit', 'avgclosingprice', 'closedprice',
  ],
  stopLoss: ['stoploss', 'sl', 'stop'],
  takeProfit: ['takeprofit', 'tp', 'target', 'profittarget'],
  fees: ['fee', 'fees', 'tradingfee'],
  commission: ['commission', 'comm'],
  swap: ['swap', 'funding', 'fundingfee', 'rollover'],
  setup: ['setup', 'strategy', 'pattern'],
  timeframe: ['timeframe', 'tf', 'interval'],
  notes: ['notes', 'comment', 'remark', 'memo'],
  externalId: ['orderid', 'id', 'ticket', 'tradeid', 'dealid', 'transactionid'],
  // Not imported as a value — used to work out each symbol's contract size.
  netPnl: ['netpnl', 'profit', 'realisedpnl', 'realizedpnl', 'pnl', 'gain'],
};

/** Best-effort automatic mapping. The user can override every choice. */
export function guessMapping(headers: string[]): Partial<Record<ImportField, number>> {
  const normalised = headers.map(normaliseHeader);
  const mapping: Partial<Record<ImportField, number>> = {};
  const taken = new Set<number>();

  for (const field of IMPORT_FIELDS) {
    for (const alias of ALIASES[field]) {
      // Exact match first so "price" does not steal the column that
      // "closeprice" should have taken.
      const exact = normalised.findIndex((h, i) => h === alias && !taken.has(i));
      if (exact !== -1) {
        mapping[field] = exact;
        taken.add(exact);
        break;
      }
    }
  }

  for (const field of IMPORT_FIELDS) {
    if (mapping[field] !== undefined) continue;
    for (const alias of ALIASES[field]) {
      const partial = normalised.findIndex((h, i) => h.includes(alias) && !taken.has(i));
      if (partial !== -1) {
        mapping[field] = partial;
        taken.add(partial);
        break;
      }
    }
  }

  return mapping;
}

/**
 * Handles thousands separators, European decimal commas, and accounting
 * negatives like "(12.50)". Returns null rather than NaN so callers can tell
 * "absent" from "unparseable" downstream.
 */
export function parseNumber(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  let value = raw.trim();
  if (value === '' || value === '-' || value.toLowerCase() === 'null') return null;

  let negative = false;
  if (/^\(.*\)$/.test(value)) {
    negative = true;
    value = value.slice(1, -1);
  }

  value = value.replace(/[^0-9.,\-+eE]/g, '');
  // "abc" strips down to "", and Number("") is 0 — a finite value that would
  // sail past the check below and silently import as a zero price.
  if (!/\d/.test(value)) return null;

  const lastComma = value.lastIndexOf(',');
  const lastDot = value.lastIndexOf('.');

  if (lastComma !== -1 && lastDot !== -1) {
    // Whichever separator comes last is the decimal point.
    if (lastComma > lastDot) value = value.replace(/\./g, '').replace(',', '.');
    else value = value.replace(/,/g, '');
  } else if (lastComma !== -1) {
    const decimals = value.length - lastComma - 1;
    // "1,234" is a thousands group; "1,23" is a decimal comma.
    value = decimals === 3 ? value.replace(/,/g, '') : value.replace(',', '.');
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return negative ? -parsed : parsed;
}

/**
 * Broker exports use at least four date shapes. `dayFirst` resolves the
 * genuine ambiguity in 01/02/2025 — there is no way to detect it reliably,
 * so the user is asked.
 */
export function parseDate(raw: string | undefined, dayFirst = true): string | null {
  if (!raw) return null;
  const value = raw.trim();
  if (value === '') return null;

  // Unix seconds or milliseconds
  if (/^\d{10}$/.test(value)) return new Date(Number(value) * 1000).toISOString();
  if (/^\d{13}$/.test(value)) return new Date(Number(value)).toISOString();

  // ISO, with or without a zone
  const iso = value.match(
    /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?(Z|[+-]\d{2}:?\d{2})?$/,
  );
  if (iso) {
    const [, y, m, d, hh, mm, ss, zone] = iso;
    if (zone) return new Date(value.replace(' ', 'T')).toISOString();
    return localToIso(+y!, +m!, +d!, +hh!, +mm!, +(ss ?? 0));
  }

  // MT4/MT5: 2025.01.04 09:30:00
  const mt = value.match(/^(\d{4})\.(\d{2})\.(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (mt) {
    const [, y, m, d, hh, mm, ss] = mt;
    return localToIso(+y!, +m!, +d!, +hh!, +mm!, +(ss ?? 0));
  }

  // Date only
  const dateOnly = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnly) {
    const [, y, m, d] = dateOnly;
    return localToIso(+y!, +m!, +d!, 0, 0, 0);
  }

  // Slash or dash separated, ambiguous order
  const slash = value.match(
    /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/,
  );
  if (slash) {
    const [, a, b, y, hh, mm, ss] = slash;
    const day = dayFirst ? +a! : +b!;
    const month = dayFirst ? +b! : +a!;
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return localToIso(+y!, month, day, +(hh ?? 0), +(mm ?? 0), +(ss ?? 0));
  }

  const fallback = new Date(value);
  return Number.isNaN(fallback.getTime()) ? null : fallback.toISOString();
}

/** Wall-clock values from an export are local time; store the absolute instant. */
function localToIso(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
): string | null {
  const date = new Date(year, month - 1, day, hour, minute, second);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

const LONG_WORDS = ['buy', 'long', 'b', 'bid', 'buylong', 'openlong'];
const SHORT_WORDS = ['sell', 'short', 's', 'ask', 'sellshort', 'openshort'];

export function parseDirection(raw: string | undefined): 'long' | 'short' | null {
  if (!raw) return null;
  const value = normaliseHeader(raw);
  if (LONG_WORDS.includes(value)) return 'long';
  if (SHORT_WORDS.includes(value)) return 'short';
  if (value.includes('sell') || value.includes('short')) return 'short';
  if (value.includes('buy') || value.includes('long')) return 'long';
  return null;
}

export interface MappedRow {
  index: number;
  values: Record<string, unknown>;
}

export function mapRow(
  row: string[],
  mapping: Partial<Record<ImportField, number>>,
  index: number,
  options: { dayFirst?: boolean; defaultContractSize?: number } = {},
): MappedRow {
  const cell = (field: ImportField): string | undefined => {
    const column = mapping[field];
    return column === undefined ? undefined : row[column];
  };

  const openedAt = parseDate(cell('openedAt'), options.dayFirst ?? true);
  const closedAt = parseDate(cell('closedAt'), options.dayFirst ?? true);
  const exitPrice = parseNumber(cell('exitPrice'));

  // A row is only "closed" when both an exit price and a close time survived
  // parsing. Guessing either one would fabricate a result.
  const closed = exitPrice !== null && closedAt !== null;

  return {
    index,
    values: {
      symbol: (cell('symbol') ?? '').trim().toUpperCase(),
      direction: parseDirection(cell('direction')),
      status: closed ? 'closed' : 'open',
      openedAt,
      closedAt: closed ? closedAt : null,
      quantity: parseNumber(cell('quantity')),
      contractSize: parseNumber(cell('contractSize')) ?? options.defaultContractSize ?? 1,
      entryPrice: parseNumber(cell('entryPrice')),
      exitPrice: closed ? exitPrice : null,
      stopLoss: parseNumber(cell('stopLoss')),
      takeProfit: parseNumber(cell('takeProfit')),
      fees: parseNumber(cell('fees')) ?? 0,
      commission: parseNumber(cell('commission')) ?? 0,
      swap: parseNumber(cell('swap')) ?? 0,
      setup: cell('setup')?.trim() || null,
      timeframe: cell('timeframe')?.trim() || null,
      notes: cell('notes')?.trim() || null,
      externalId: cell('externalId')?.trim() || null,
    },
  };
}

/** Multipliers worth snapping to; anything else is kept as measured. */
const COMMON_CONTRACT_SIZES = [
  1, 10, 20, 50, 100, 500, 1000, 5000, 10_000, 50_000, 100_000,
];

function snapSize(value: number): number {
  for (const candidate of COMMON_CONTRACT_SIZES) {
    if (Math.abs(value - candidate) / candidate < 0.02) return candidate;
  }
  return value;
}

function medianOf(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2
    : (sorted[mid] ?? 0);
}

/**
 * Works out what one lot is worth per symbol by comparing the broker's own
 * realised P&L against the price movement in the same row.
 *
 * A single account routinely mixes gold at 100 ounces a lot, forex at 100,000
 * units and crypto at 1. Assuming one value for all of them makes every
 * number in the journal wrong, and no export states it outright.
 */
export function inferContractSizes(
  rows: string[][],
  mapping: Partial<Record<ImportField, number>>,
  options: { minSamples?: number } = {},
): Record<string, number> {
  const pnlColumn = mapping.netPnl;
  if (pnlColumn === undefined) return {};

  const ratios = new Map<string, number[]>();

  for (const row of rows) {
    const cell = (field: ImportField) => {
      const column = mapping[field];
      return column === undefined ? undefined : row[column];
    };

    const symbol = (cell('symbol') ?? '').trim().toUpperCase();
    const direction = parseDirection(cell('direction'));
    const quantity = parseNumber(cell('quantity'));
    const entry = parseNumber(cell('entryPrice'));
    const exit = parseNumber(cell('exitPrice'));
    const pnl = parseNumber(row[pnlColumn]);

    if (!symbol || direction === null || !quantity || entry === null || exit === null) continue;
    if (pnl === null || pnl === 0) continue;

    const move = (exit - entry) * (direction === 'long' ? 1 : -1) * quantity;
    if (move === 0) continue;

    const ratio = pnl / move;
    // A negative ratio means the row disagrees with itself — usually a sign
    // convention we have misread. Better dropped than averaged in.
    if (!Number.isFinite(ratio) || ratio <= 0) continue;

    const list = ratios.get(symbol) ?? [];
    list.push(ratio);
    ratios.set(symbol, list);
  }

  const minimum = options.minSamples ?? 3;
  const sizes: Record<string, number> = {};

  for (const [symbol, values] of ratios) {
    // Median, not mean: a couple of rows with fees folded into the P&L should
    // not drag the answer. Below the minimum we say nothing rather than guess.
    if (values.length >= minimum) sizes[symbol] = snapSize(medianOf(values));
  }

  return sizes;
}
