import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { Trade } from '@/lib/types/trade';
import type { Database } from '@/lib/types/database';

type TradeRow = Database['public']['Tables']['trades']['Row'];

/**
 * Postgres numerics arrive as strings once they exceed JS-safe precision, so
 * every numeric column goes through here. Silently getting "12.5" where a
 * number is expected turns P&L into string concatenation.
 */
function num(value: number | string | null): number {
  if (value === null) return 0;
  const parsed = typeof value === 'string' ? Number(value) : value;
  return Number.isFinite(parsed) ? parsed : 0;
}

function nullableNum(value: number | string | null): number | null {
  if (value === null) return null;
  const parsed = typeof value === 'string' ? Number(value) : value;
  return Number.isFinite(parsed) ? parsed : null;
}

/** Database row → domain object. The metrics engine only ever sees this shape. */
export function toTrade(row: TradeRow): Trade {
  return {
    id: row.id,
    accountId: row.account_id,
    symbol: row.symbol,
    market: row.market,
    direction: row.direction,
    status: row.status,
    openedAt: row.opened_at,
    closedAt: row.closed_at,
    quantity: num(row.quantity),
    contractSize: num(row.contract_size) || 1,
    entryPrice: num(row.entry_price),
    exitPrice: nullableNum(row.exit_price),
    stopLoss: nullableNum(row.stop_loss),
    takeProfit: nullableNum(row.take_profit),
    fees: num(row.fees),
    commission: num(row.commission),
    swap: num(row.swap),
    strategyId: row.strategy_id,
    setup: row.setup,
    timeframe: row.timeframe,
    session: row.session,
    marketCondition: row.market_condition,
    emotion: row.emotion,
    confidence: row.confidence,
    executionRating: row.execution_rating,
    notes: row.notes,
    tags: row.tags ?? [],
  };
}

export interface AccountSummary {
  id: string;
  name: string;
  broker: string | null;
  market: string;
  currency: string;
  startingBalance: number;
}

export async function getAccounts(userId: string): Promise<AccountSummary[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('accounts')
    .select('id, name, broker, market, currency, starting_balance')
    .eq('user_id', userId)
    .eq('is_archived', false)
    .order('created_at', { ascending: true });

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    broker: row.broker,
    market: row.market,
    currency: row.currency,
    startingBalance: num(row.starting_balance),
  }));
}

/**
 * All trades for one account. Pagination lands with the journal table; the
 * dashboard needs the full set because equity curve and drawdown are
 * path-dependent — you cannot compute them from a page of rows.
 */
export async function getTrades(userId: string, accountId: string): Promise<Trade[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('trades')
    .select('*')
    .eq('user_id', userId)
    .eq('account_id', accountId)
    .order('opened_at', { ascending: false })
    .limit(5000);

  return (data ?? []).map(toTrade);
}

export interface TradeQuery {
  accountId: string;
  status?: 'open' | 'closed' | 'all';
  direction?: 'long' | 'short' | 'all';
  search?: string;
  sort?: 'opened_at' | 'closed_at' | 'symbol' | 'net_pnl' | 'r_multiple';
  order?: 'asc' | 'desc';
  page?: number;
  perPage?: number;
}

/**
 * Filtering and sorting run in Postgres, not in JS: the journal can hold
 * thousands of rows and shipping them all to sort client-side would put the
 * whole table in the response payload.
 */
export async function queryTrades(
  userId: string,
  q: TradeQuery,
): Promise<{ trades: Trade[]; total: number }> {
  const supabase = await createClient();
  const perPage = q.perPage ?? 25;
  const page = Math.max(1, q.page ?? 1);
  const from = (page - 1) * perPage;

  let request = supabase
    .from('trades')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
    .eq('account_id', q.accountId);

  if (q.status && q.status !== 'all') request = request.eq('status', q.status);
  if (q.direction && q.direction !== 'all') request = request.eq('direction', q.direction);
  if (q.search) {
    // ilike with a wildcard on both sides; the value is parameterised by
    // postgrest, so a % or _ in user input filters oddly but cannot inject.
    request = request.ilike('symbol', `%${q.search}%`);
  }

  const { data, count } = await request
    .order(q.sort ?? 'opened_at', {
      ascending: q.order === 'asc',
      nullsFirst: false,
    })
    .range(from, from + perPage - 1);

  return { trades: (data ?? []).map(toTrade), total: count ?? 0 };
}

export async function getTrade(userId: string, tradeId: string): Promise<Trade | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('trades')
    .select('*')
    .eq('user_id', userId)
    .eq('id', tradeId)
    .maybeSingle();

  return data ? toTrade(data) : null;
}
