import type { Trade } from '@/lib/types/trade';
import { computeTradeResult } from './trade';
import { computePortfolioStats, sortClosed, type PortfolioStats } from './portfolio';

export interface BreakdownRow {
  key: string;
  label: string;
  stats: PortfolioStats;
  /**
   * False when the group has too few trades to draw a conclusion from. The UI
   * still shows the row — hiding it would hide the fact that you barely trade
   * this setup — but marks it as not yet meaningful.
   */
  reliable: boolean;
}

/** Below this, win rate swings double digits on a single trade. */
export const MIN_SAMPLE = 10;

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export type Dimension =
  | 'setup'
  | 'session'
  | 'direction'
  | 'symbol'
  | 'timeframe'
  | 'emotion'
  | 'weekday'
  | 'hour'
  | 'confidence'
  | 'rMultiple';

/** How each dimension reads a trade. Null means "not recorded" and is kept. */
const EXTRACTORS: Record<Dimension, (trade: Trade) => string | null> = {
  setup: (t) => t.setup,
  session: (t) => t.session,
  direction: (t) => t.direction,
  symbol: (t) => t.symbol,
  timeframe: (t) => t.timeframe,
  emotion: (t) => t.emotion,
  weekday: (t) => String(new Date(t.closedAt ?? t.openedAt).getDay()),
  hour: (t) => String(new Date(t.openedAt).getHours()),
  confidence: (t) => (t.confidence === null ? null : String(t.confidence)),
  rMultiple: (t) => {
    const r = computeTradeResult(t).rMultiple;
    if (r === null) return null;
    if (r <= -2) return 'a';
    if (r < 0) return 'b';
    if (r < 1) return 'c';
    if (r < 2) return 'd';
    if (r < 3) return 'e';
    return 'f';
  },
};

const R_BUCKET_LABELS: Record<string, string> = {
  a: 'Worse than −2R',
  b: '−2R to 0',
  c: '0 to 1R',
  d: '1R to 2R',
  e: '2R to 3R',
  f: '3R and above',
};

function labelFor(dimension: Dimension, key: string): string {
  if (key === '__none__') return 'Not recorded';

  switch (dimension) {
    case 'weekday':
      return DAYS[Number(key)] ?? key;
    case 'hour':
      return `${key.padStart(2, '0')}:00`;
    case 'direction':
      return key === 'long' ? 'Long' : 'Short';
    case 'confidence':
      return `${key} / 10`;
    case 'rMultiple':
      return R_BUCKET_LABELS[key] ?? key;
    case 'session':
    case 'emotion':
      return key.charAt(0).toUpperCase() + key.slice(1);
    default:
      return key;
  }
}

/** Sort order that keeps ordered dimensions ordered and the rest by result. */
function sortRows(dimension: Dimension, rows: BreakdownRow[]): BreakdownRow[] {
  const ordered: Dimension[] = ['weekday', 'hour', 'confidence', 'rMultiple'];

  if (ordered.includes(dimension)) {
    return rows.sort((a, b) => a.key.localeCompare(b.key, undefined, { numeric: true }));
  }
  return rows.sort((a, b) => b.stats.netPnl - a.stats.netPnl);
}

export function breakdownBy(
  trades: Trade[],
  dimension: Dimension,
  startingBalance = 0,
): BreakdownRow[] {
  const extract = EXTRACTORS[dimension];
  const groups = new Map<string, Trade[]>();

  for (const trade of sortClosed(trades)) {
    const key = extract(trade) ?? '__none__';
    const bucket = groups.get(key);
    if (bucket) bucket.push(trade);
    else groups.set(key, [trade]);
  }

  const rows: BreakdownRow[] = [];
  for (const [key, group] of groups) {
    // Each group gets the account's starting balance so its drawdown is
    // measured on a comparable base, not on the group's own first trade.
    const stats = computePortfolioStats(group, startingBalance);
    rows.push({
      key,
      label: labelFor(dimension, key),
      stats,
      reliable: stats.closedTrades >= MIN_SAMPLE,
    });
  }

  return sortRows(dimension, rows);
}

export interface DayCell {
  date: string;
  netPnl: number;
  trades: number;
}

/** One cell per calendar day that has closed trades. Empty days are absent. */
export function dailyPnl(trades: Trade[]): DayCell[] {
  const byDay = new Map<string, DayCell>();

  for (const trade of sortClosed(trades)) {
    const date = (trade.closedAt ?? trade.openedAt).slice(0, 10);
    const cell = byDay.get(date) ?? { date, netPnl: 0, trades: 0 };
    cell.netPnl += computeTradeResult(trade).netPnl;
    cell.trades += 1;
    byDay.set(date, cell);
  }

  return [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export interface DistributionBucket {
  label: string;
  count: number;
  from: number;
}

/**
 * R-multiple histogram. Trades without a stop have no R and are excluded
 * rather than dumped into a zero bucket, which would invent a mode at zero.
 */
export function rDistribution(trades: Trade[]): DistributionBucket[] {
  const edges = [-3, -2, -1, 0, 1, 2, 3, 4];
  const buckets: DistributionBucket[] = edges.map((from, i) => ({
    from,
    label:
      i === 0 ? '≤ −3R' : i === edges.length - 1 ? '≥ 4R' : `${from}R to ${from + 1}R`,
    count: 0,
  }));

  for (const trade of sortClosed(trades)) {
    const r = computeTradeResult(trade).rMultiple;
    if (r === null) continue;

    let index = edges.findIndex((edge, i) => {
      const next = edges[i + 1];
      return next === undefined ? r >= edge : r >= edge && r < next;
    });
    if (r < edges[0]!) index = 0;
    if (index === -1) index = buckets.length - 1;

    buckets[index]!.count += 1;
  }

  return buckets;
}

export interface Period {
  from: string;
  to: string;
  label: string;
}

/** Named ranges, resolved against the viewer's own clock. */
export function resolvePeriod(key: string, now = new Date()): Period {
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const iso = (d: Date) => d.toISOString();

  const today = startOfDay(now);
  const endOfToday = new Date(today.getTime() + 86_400_000 - 1);

  switch (key) {
    case 'week': {
      // Weeks start on Monday; getDay() is Sunday-first.
      const monday = new Date(today);
      monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
      return { from: iso(monday), to: iso(endOfToday), label: 'This week' };
    }
    case 'last-month': {
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const last = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      return {
        from: iso(first),
        to: iso(last),
        label: first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
      };
    }
    case 'quarter': {
      const first = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
      return { from: iso(first), to: iso(endOfToday), label: 'This quarter' };
    }
    case 'year': {
      const first = new Date(now.getFullYear(), 0, 1);
      return { from: iso(first), to: iso(endOfToday), label: String(now.getFullYear()) };
    }
    case 'all':
      return { from: '1970-01-01T00:00:00.000Z', to: iso(endOfToday), label: 'All time' };
    case 'month':
    default: {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      return {
        from: iso(first),
        to: iso(endOfToday),
        label: first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
      };
    }
  }
}

/**
 * Filters on close time, not open time: a trade opened in March and closed in
 * April belongs to April's result, because that is when the money moved.
 * Open trades have no result yet and are excluded from every report.
 */
export function tradesInPeriod(trades: Trade[], period: Period): Trade[] {
  return trades.filter((trade) => {
    if (trade.status !== 'closed' || !trade.closedAt) return false;
    return trade.closedAt >= period.from && trade.closedAt <= period.to;
  });
}
