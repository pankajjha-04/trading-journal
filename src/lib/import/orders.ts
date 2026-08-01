import { normaliseHeader } from './csv';
import { parseDate, parseDirection, parseNumber } from './map';

/**
 * Many brokers export *orders*, not positions. One trade is then spread across
 * at least two rows — a fill that opens it and a fill that closes it — mixed in
 * with cancelled bracket orders that never executed.
 *
 * This rebuilds positions by netting fills FIFO, the way the broker's own
 * ledger does.
 */

export const ORDER_FIELDS = [
  'symbol',
  'side',
  'quantity',
  'price',
  'filledAt',
  'status',
  'orderType',
  'netPnl',
  'externalId',
] as const;

export type OrderField = (typeof ORDER_FIELDS)[number];

export const ORDER_FIELD_LABELS: Record<OrderField, string> = {
  symbol: 'Symbol or pair',
  side: 'Side (buy/sell)',
  quantity: 'Quantity or lot size',
  price: 'Fill price',
  filledAt: 'Date',
  status: 'Status',
  orderType: 'Order type',
  netPnl: 'Realised P&L',
  externalId: 'Order ID',
};

export const ORDER_REQUIRED: OrderField[] = ['symbol', 'side', 'quantity', 'price', 'filledAt'];

const ORDER_ALIASES: Record<OrderField, string[]> = {
  symbol: ['pair', 'symbol', 'instrument', 'ticker', 'contract', 'market'],
  side: ['side', 'direction', 'buysell'],
  quantity: ['lotsize', 'quantity', 'qty', 'size', 'volume', 'amount', 'filledqty'],
  price: ['price', 'fillprice', 'avgprice', 'executedprice'],
  filledAt: ['date', 'time', 'datetime', 'filledat', 'updatetime', 'createtime'],
  status: ['status', 'state', 'orderstatus'],
  orderType: ['type', 'ordertype', 'kind'],
  netPnl: ['netpnl', 'pnl', 'realisedpnl', 'realizedpnl', 'profit', 'pl'],
  externalId: ['orderid', 'id', 'ticket', 'dealid', 'tradeid'],
};

export function guessOrderMapping(headers: string[]): Partial<Record<OrderField, number>> {
  const normalised = headers.map(normaliseHeader);
  const mapping: Partial<Record<OrderField, number>> = {};
  const taken = new Set<number>();

  for (const pass of ['exact', 'partial'] as const) {
    for (const field of ORDER_FIELDS) {
      if (mapping[field] !== undefined) continue;
      for (const alias of ORDER_ALIASES[field]) {
        const index = normalised.findIndex((header, i) =>
          taken.has(i) ? false : pass === 'exact' ? header === alias : header.includes(alias),
        );
        if (index !== -1) {
          mapping[field] = index;
          taken.add(index);
          break;
        }
      }
    }
  }

  return mapping;
}

/** Words brokers use for an order that actually executed. */
const FILLED_WORDS = ['filled', 'closed', 'executed', 'complete', 'completed', 'done', 'success'];

export function isFilled(status: string | undefined): boolean {
  if (status === undefined || status.trim() === '') return true; // no column, assume fills only
  const value = normaliseHeader(status);
  return FILLED_WORDS.some((word) => value.includes(word));
}

export interface OrderFill {
  symbol: string;
  side: 'long' | 'short';
  quantity: number;
  price: number;
  filledAt: string;
  netPnl: number | null;
  externalId: string | null;
}

export interface ReconstructedTrade {
  symbol: string;
  direction: 'long' | 'short';
  quantity: number;
  contractSize: number;
  entryPrice: number;
  exitPrice: number;
  openedAt: string;
  closedAt: string;
  externalId: string | null;
}

export interface ReconstructionResult {
  trades: ReconstructedTrade[];
  openLots: number;
  filledOrders: number;
  skippedOrders: number;
  /** Contract multiplier per symbol, derived from the broker's own P&L. */
  multipliers: Record<string, number>;
  /** Difference between reported and reconstructed P&L, when P&L was mapped. */
  reportedPnl: number | null;
  computedPnl: number | null;
}

export function toOrderFills(
  rows: string[][],
  mapping: Partial<Record<OrderField, number>>,
  options: { dayFirst?: boolean } = {},
): { fills: OrderFill[]; skipped: number } {
  const cell = (row: string[], field: OrderField) => {
    const column = mapping[field];
    return column === undefined ? undefined : row[column];
  };

  const fills: OrderFill[] = [];
  let skipped = 0;

  for (const row of rows) {
    if (!isFilled(cell(row, 'status'))) {
      skipped += 1;
      continue;
    }

    const symbol = (cell(row, 'symbol') ?? '').trim().toUpperCase();
    const side = parseDirection(cell(row, 'side'));
    const quantity = parseNumber(cell(row, 'quantity'));
    const price = parseNumber(cell(row, 'price'));
    const filledAt = parseDate(cell(row, 'filledAt'), options.dayFirst ?? true);

    if (!symbol || side === null || !quantity || !price || !filledAt) {
      skipped += 1;
      continue;
    }

    fills.push({
      symbol,
      side,
      quantity,
      price,
      filledAt,
      netPnl: parseNumber(cell(row, 'netPnl')),
      externalId: cell(row, 'externalId')?.trim() || null,
    });
  }

  return { fills, skipped };
}

/** Multipliers worth snapping to; anything else is kept as measured. */
const COMMON_MULTIPLIERS = [1, 10, 20, 50, 100, 500, 1000, 10_000, 100_000];

function snap(value: number): number {
  for (const candidate of COMMON_MULTIPLIERS) {
    if (Math.abs(value - candidate) / candidate < 0.02) return candidate;
  }
  return value;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2
    : (sorted[mid] ?? 0);
}

interface Lot {
  quantity: number; // signed: positive long, negative short
  price: number;
  at: string;
}

/**
 * FIFO netting. A fill that opposes the open position closes it, oldest lot
 * first, splitting when quantities do not line up. A fill in the same
 * direction adds a lot. This is how partial exits and scaling in survive.
 */
export function reconstructPositions(fills: OrderFill[]): {
  trades: Omit<ReconstructedTrade, 'contractSize'>[];
  openLots: number;
  closureMoves: { symbol: string; move: number; externalId: string | null }[];
} {
  const ordered = [...fills].sort((a, b) => a.filledAt.localeCompare(b.filledAt));
  const books = new Map<string, Lot[]>();
  const trades: Omit<ReconstructedTrade, 'contractSize'>[] = [];
  const closureMoves: { symbol: string; move: number; externalId: string | null }[] = [];

  for (const fill of ordered) {
    let remaining = fill.side === 'long' ? fill.quantity : -fill.quantity;
    const book = books.get(fill.symbol) ?? [];
    let move = 0;

    while (Math.abs(remaining) > 1e-9 && book.length > 0) {
      const lot = book[0]!;
      const opposes = lot.quantity > 0 !== remaining > 0;
      if (!opposes) break;

      const take = Math.min(Math.abs(lot.quantity), Math.abs(remaining));
      const isLong = lot.quantity > 0;
      const sign = isLong ? 1 : -1;

      move += (fill.price - lot.price) * sign * take;

      trades.push({
        symbol: fill.symbol,
        direction: isLong ? 'long' : 'short',
        quantity: take,
        entryPrice: lot.price,
        exitPrice: fill.price,
        openedAt: lot.at,
        closedAt: fill.filledAt,
        externalId: fill.externalId,
      });

      lot.quantity -= isLong ? take : -take;
      remaining -= remaining > 0 ? take : -take;
      if (Math.abs(lot.quantity) < 1e-9) book.shift();
    }

    if (move !== 0) {
      closureMoves.push({ symbol: fill.symbol, move, externalId: fill.externalId });
    }

    if (Math.abs(remaining) > 1e-9) {
      book.push({ quantity: remaining, price: fill.price, at: fill.filledAt });
    }

    books.set(fill.symbol, book);
  }

  let openLots = 0;
  for (const book of books.values()) openLots += book.length;

  return { trades, openLots, closureMoves };
}

/**
 * Derives the contract multiplier per symbol by comparing the broker's own
 * realised P&L against the price movement we reconstructed. This is how a
 * gold lot is discovered to be 100 ounces without anyone typing it in.
 */
export function inferMultipliers(
  fills: OrderFill[],
  closureMoves: { symbol: string; move: number; externalId: string | null }[],
): Record<string, number> {
  const pnlByOrder = new Map<string, number>();
  for (const fill of fills) {
    if (fill.netPnl !== null && fill.externalId) pnlByOrder.set(fill.externalId, fill.netPnl);
  }

  const ratios = new Map<string, number[]>();
  for (const closure of closureMoves) {
    if (!closure.externalId || closure.move === 0) continue;
    const pnl = pnlByOrder.get(closure.externalId);
    if (pnl === undefined || pnl === 0) continue;

    const ratio = pnl / closure.move;
    if (!Number.isFinite(ratio) || ratio <= 0) continue;
    const list = ratios.get(closure.symbol) ?? [];
    list.push(ratio);
    ratios.set(closure.symbol, list);
  }

  const result: Record<string, number> = {};
  for (const [symbol, values] of ratios) {
    // Median, not mean: a few mispaired closures should not move the answer.
    if (values.length >= 3) result[symbol] = snap(median(values));
  }
  return result;
}

export function reconstruct(
  rows: string[][],
  mapping: Partial<Record<OrderField, number>>,
  options: { dayFirst?: boolean; defaultMultiplier?: number } = {},
): ReconstructionResult {
  const { fills, skipped } = toOrderFills(rows, mapping, options);
  const { trades, openLots, closureMoves } = reconstructPositions(fills);
  const multipliers = inferMultipliers(fills, closureMoves);

  const withSize: ReconstructedTrade[] = trades.map((trade) => ({
    ...trade,
    contractSize: multipliers[trade.symbol] ?? options.defaultMultiplier ?? 1,
  }));

  const hasPnl = fills.some((f) => f.netPnl !== null);
  const reportedPnl = hasPnl
    ? fills.reduce((sum, f) => sum + (f.netPnl ?? 0), 0)
    : null;

  const computedPnl = hasPnl
    ? withSize.reduce((sum, t) => {
        const sign = t.direction === 'long' ? 1 : -1;
        return sum + (t.exitPrice - t.entryPrice) * sign * t.quantity * t.contractSize;
      }, 0)
    : null;

  return {
    trades: withSize,
    openLots,
    filledOrders: fills.length,
    skippedOrders: skipped,
    multipliers,
    reportedPnl,
    computedPnl,
  };
}
