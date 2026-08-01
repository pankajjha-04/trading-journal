export type Direction = 'long' | 'short';
export type TradeStatus = 'open' | 'closed' | 'cancelled';
export type MarketType = 'forex' | 'crypto' | 'futures' | 'stocks' | 'options' | 'indices';
export type Session = 'asia' | 'london' | 'newyork' | 'overlap' | 'other';
export type Emotion =
  | 'calm'
  | 'confident'
  | 'fearful'
  | 'greedy'
  | 'revenge'
  | 'fomo'
  | 'impatient'
  | 'bored';

/**
 * A trade as it exists in the domain layer.
 * Prices are decimals; money fields are in the account's base currency.
 * `contractSize` is the multiplier that converts price movement to currency:
 *   - crypto/stocks: 1
 *   - forex standard lot: 100_000
 *   - futures: contract-specific (ES = 50)
 */
export interface Trade {
  id: string;
  accountId: string;
  symbol: string;
  market: MarketType;
  direction: Direction;
  status: TradeStatus;

  openedAt: string;
  closedAt: string | null;

  quantity: number;
  contractSize: number;
  entryPrice: number;
  exitPrice: number | null;
  stopLoss: number | null;
  takeProfit: number | null;

  fees: number;
  commission: number;
  swap: number;

  strategyId: string | null;
  setup: string | null;
  timeframe: string | null;
  session: Session | null;
  marketCondition: string | null;
  emotion: Emotion | null;
  confidence: number | null;
  executionRating: number | null;

  notes: string | null;
  tags: string[];
}

/** Per-trade derived values. Never stored — always recomputed from source fields. */
export interface TradeResult {
  grossPnl: number;
  costs: number;
  netPnl: number;
  /** Return on the capital committed to the position. */
  returnPct: number;
  /** Planned risk in currency, from entry→stop. Null when no stop was set. */
  riskAmount: number | null;
  /** Realised result expressed in units of planned risk. */
  rMultiple: number | null;
  /** Planned reward:risk at entry, from stop and target. */
  plannedRr: number | null;
  isWin: boolean;
  isScratch: boolean;
}
