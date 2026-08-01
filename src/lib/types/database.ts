/**
 * Row shapes are `type` aliases, not `interface`s, on purpose: interfaces have
 * no implicit index signature, so they fail supabase-js's `Record<string,
 * unknown>` constraint and every query silently resolves to `never`.
 *
 * Hand-maintained to match supabase/migrations. Regenerate after any schema
 * change with `npm run db:types` — never edit both by hand and drift.
 */

export type Direction = 'long' | 'short';
export type TradeStatus = 'open' | 'closed' | 'cancelled';
export type MarketType = 'forex' | 'crypto' | 'futures' | 'stocks' | 'options' | 'indices';
export type SessionType = 'asia' | 'london' | 'newyork' | 'overlap' | 'other';
export type EmotionType =
  | 'calm' | 'confident' | 'fearful' | 'greedy'
  | 'revenge' | 'fomo' | 'impatient' | 'bored';
export type PlanTier = 'free' | 'pro' | 'lifetime';
export type SubStatus = 'trialing' | 'active' | 'past_due' | 'cancelled' | 'expired';
export type UserRole = 'user' | 'support' | 'admin';

type ProfileRow = {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: UserRole;
  timezone: string;
  base_currency: string;
  theme: 'dark' | 'light' | 'system';
  onboarded_at: string | null;
  created_at: string;
  updated_at: string;
}

type AccountRow = {
  id: string;
  user_id: string;
  name: string;
  broker: string | null;
  market: MarketType;
  currency: string;
  starting_balance: number;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

type StrategyRow = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  rules: string[];
  color: string;
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
}

type TradeRow = {
  id: string;
  user_id: string;
  account_id: string;
  strategy_id: string | null;
  symbol: string;
  market: MarketType;
  direction: Direction;
  status: TradeStatus;
  opened_at: string;
  closed_at: string | null;
  quantity: number;
  contract_size: number;
  entry_price: number;
  exit_price: number | null;
  stop_loss: number | null;
  take_profit: number | null;
  fees: number;
  commission: number;
  swap: number;
  gross_pnl: number | null;
  net_pnl: number | null;
  r_multiple: number | null;
  setup: string | null;
  timeframe: string | null;
  session: SessionType | null;
  market_condition: string | null;
  emotion: EmotionType | null;
  confidence: number | null;
  execution_rating: number | null;
  notes: string | null;
  tags: string[];
  import_batch_id: string | null;
  external_id: string | null;
  created_at: string;
  updated_at: string;
}

type JournalEntryRow = {
  id: string;
  user_id: string;
  entry_date: string;
  pre_market: string | null;
  reflection: string | null;
  mood: number | null;
  discipline: number | null;
  followed_rules: boolean | null;
  meditated: boolean;
  created_at: string;
  updated_at: string;
}

type SubscriptionRow = {
  id: string;
  user_id: string;
  plan_id: string;
  status: SubStatus;
  provider: 'stripe' | 'razorpay' | 'crypto' | 'manual';
  provider_ref: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  created_at: string;
  updated_at: string;
}

type ImportBatchRow = {
  id: string;
  user_id: string;
  account_id: string;
  source: 'csv' | 'excel' | 'mt4' | 'mt5' | 'binance' | 'bybit' | 'okx' | 'coinbase' | 'manual';
  filename: string | null;
  row_count: number;
  imported: number;
  skipped: number;
  errors: { row: number; field: string; message: string }[];
  created_at: string;
};

type GoalRow = {
  id: string;
  user_id: string;
  account_id: string | null;
  metric: 'net_pnl' | 'win_rate' | 'profit_factor' | 'trade_count' | 'max_risk' | 'discipline';
  period: 'daily' | 'weekly' | 'monthly' | 'yearly';
  target: number;
  starts_on: string;
  ends_on: string | null;
  is_active: boolean;
  created_at: string;
};

type PaymentRow = {
  id: string;
  user_id: string;
  plan_id: string;
  provider: 'stripe' | 'razorpay' | 'crypto';
  provider_ref: string | null;
  status: 'pending' | 'paid' | 'failed' | 'refunded';
  amount_minor: number;
  currency: string;
  event_id: string | null;
  raw: unknown;
  created_at: string;
};

type InvoiceRow = {
  id: string;
  user_id: string;
  payment_id: string | null;
  number: string;
  issued_on: string;
  subtotal_minor: number;
  tax_minor: number;
  total_minor: number;
  currency: string;
  tax_label: string | null;
  place_of_supply: string | null;
  created_at: string;
};

type NewsletterRow = {
  id: string;
  email: string;
  source: string;
  confirmed_at: string | null;
  created_at: string;
};

type AiReviewRow = {
  id: string;
  user_id: string;
  trade_id: string | null;
  scope: 'trade' | 'screenshot' | 'weekly' | 'monthly';
  model: string;
  input_hash: string;
  summary: string;
  findings: { kind: 'strength' | 'weakness' | 'note'; text: string }[];
  scores: { execution: number; risk: number; discipline: number };
  token_cost: number;
  created_at: string;
};

type TradeScreenshotRow = {
  id: string;
  user_id: string;
  trade_id: string;
  storage_path: string;
  caption: string | null;
  width: number | null;
  height: number | null;
  created_at: string;
};

type PlanRow = {
  id: string;
  name: string;
  tier: PlanTier;
  price_inr: number;
  price_usd: number;
  interval: 'month' | 'year' | 'once';
  trade_limit: number | null;
  account_limit: number | null;
  ai_credits: number;
  features: string[];
  is_active: boolean;
}

/** Flattens an intersection into a plain object type — supabase-js rejects
 *  intersections when it checks the schema shape, and silently yields `never`. */
type Simplify<T> = { [K in keyof T]: T[K] };

/** Columns the database fills in: never sent by the client. */
type Generated =
  | 'id'
  | 'created_at'
  | 'updated_at'
  | 'gross_pnl'
  | 'net_pnl'
  | 'r_multiple'
  // Set by the importers, absent on manual entry.
  | 'import_batch_id'
  | 'external_id';

/** Columns that accept null are optional on insert — Postgres fills them. */
type NullableKeys<T> = {
  [K in keyof T]-?: null extends T[K] ? K : never;
}[keyof T];

type OptionalOnInsert<Row> = Extract<keyof Row, Generated> | NullableKeys<Row>;

type TableOf<Row> = {
  Row: Row;
  Insert: Simplify<
    Omit<Row, OptionalOnInsert<Row>> & Partial<Pick<Row, OptionalOnInsert<Row>>>
  >;
  Update: Partial<Row>;
  Relationships: [];
};

export interface Database {
  public: {
    Tables: {
      profiles: TableOf<ProfileRow>;
      accounts: TableOf<AccountRow>;
      strategies: TableOf<StrategyRow>;
      trades: TableOf<TradeRow>;
      journal_entries: TableOf<JournalEntryRow>;
      subscriptions: TableOf<SubscriptionRow>;
      plans: TableOf<PlanRow>;
      import_batches: TableOf<ImportBatchRow>;
      goals: TableOf<GoalRow>;
      ai_reviews: TableOf<AiReviewRow>;
      trade_screenshots: TableOf<TradeScreenshotRow>;
      newsletter_subscribers: TableOf<NewsletterRow>;
      payments: TableOf<PaymentRow>;
      invoices: TableOf<InvoiceRow>;
    };
    Views: { [_ in never]: never };
    Functions: {
      is_admin: { Args: Record<string, never>; Returns: boolean };
      next_invoice_number: { Args: Record<string, never>; Returns: string };
    };
    Enums: {
      direction: Direction;
      trade_status: TradeStatus;
      market_type: MarketType;
      session_type: SessionType;
      emotion_type: EmotionType;
      plan_tier: PlanTier;
      sub_status: SubStatus;
      user_role: UserRole;
    };
    CompositeTypes: { [_ in never]: never };
  };
}
