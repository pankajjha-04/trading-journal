-- ============================================================
-- Trading Journal — core schema
-- Every user-owned table carries user_id so RLS can be a single
-- indexed predicate rather than a join.
-- ============================================================

create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- ---------- enums ----------
create type direction    as enum ('long', 'short');
create type trade_status as enum ('open', 'closed', 'cancelled');
create type market_type  as enum ('forex', 'crypto', 'futures', 'stocks', 'options', 'indices');
create type session_type as enum ('asia', 'london', 'newyork', 'overlap', 'other');
create type emotion_type as enum ('calm','confident','fearful','greedy','revenge','fomo','impatient','bored');
create type plan_tier    as enum ('free', 'pro', 'lifetime');
create type sub_status   as enum ('trialing', 'active', 'past_due', 'cancelled', 'expired');
create type user_role    as enum ('user', 'support', 'admin');

-- ---------- profiles ----------
create table public.profiles (
  id           uuid primary key references auth.users on delete cascade,
  email        citext not null,
  full_name    text,
  avatar_url   text,
  role         user_role not null default 'user',
  timezone     text not null default 'UTC',
  base_currency char(3) not null default 'USD',
  theme        text not null default 'dark' check (theme in ('dark','light','system')),
  onboarded_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ---------- accounts ----------
create table public.accounts (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles(id) on delete cascade,
  name             text not null check (length(trim(name)) between 1 and 60),
  broker           text,
  market           market_type not null default 'crypto',
  currency         char(3) not null default 'USD',
  starting_balance numeric(20,8) not null default 0 check (starting_balance >= 0),
  is_archived      boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (user_id, name)
);

-- ---------- strategies ----------
create table public.strategies (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  name        text not null check (length(trim(name)) between 1 and 60),
  description text,
  rules       jsonb not null default '[]'::jsonb,
  color       text not null default '#6e6bf5' check (color ~* '^#[0-9a-f]{6}$'),
  is_favorite boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, name)
);

-- ---------- trades ----------
create table public.trades (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles(id) on delete cascade,
  account_id     uuid not null references public.accounts(id) on delete cascade,
  strategy_id    uuid references public.strategies(id) on delete set null,

  symbol         text not null check (length(trim(symbol)) between 1 and 32),
  market         market_type not null,
  direction      direction not null,
  status         trade_status not null default 'open',

  opened_at      timestamptz not null,
  closed_at      timestamptz,

  quantity       numeric(20,8) not null check (quantity > 0),
  contract_size  numeric(20,8) not null default 1 check (contract_size > 0),
  entry_price    numeric(20,8) not null check (entry_price > 0),
  exit_price     numeric(20,8) check (exit_price > 0),
  stop_loss      numeric(20,8) check (stop_loss > 0),
  take_profit    numeric(20,8) check (take_profit > 0),

  fees           numeric(20,8) not null default 0 check (fees >= 0),
  commission     numeric(20,8) not null default 0 check (commission >= 0),
  swap           numeric(20,8) not null default 0,

  -- Stored so the database can aggregate without replaying app logic.
  -- Kept in sync by trg_trades_derive; the app still treats src fields as truth.
  gross_pnl      numeric(20,8),
  net_pnl        numeric(20,8),
  r_multiple     numeric(12,4),

  setup          text,
  timeframe      text,
  session        session_type,
  market_condition text,
  emotion        emotion_type,
  confidence     smallint check (confidence between 1 and 10),
  execution_rating smallint check (execution_rating between 1 and 10),
  notes          text check (length(notes) <= 10000),
  tags           text[] not null default '{}',

  import_batch_id uuid,
  external_id    text,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint closed_trade_needs_exit
    check (status <> 'closed' or (exit_price is not null and closed_at is not null)),
  constraint exit_after_entry
    check (closed_at is null or closed_at >= opened_at)
);

-- Re-importing the same broker fill must not duplicate the trade.
create unique index trades_external_dedupe
  on public.trades (account_id, external_id)
  where external_id is not null;

-- ---------- screenshots ----------
create table public.trade_screenshots (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  trade_id   uuid not null references public.trades(id) on delete cascade,
  storage_path text not null,
  caption    text,
  width      integer,
  height     integer,
  created_at timestamptz not null default now()
);

-- ---------- journal / psychology ----------
create table public.journal_entries (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  entry_date    date not null,
  pre_market    text,
  reflection    text,
  mood          smallint check (mood between 1 and 10),
  discipline    smallint check (discipline between 1 and 10),
  followed_rules boolean,
  meditated     boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id, entry_date)
);

-- ---------- goals ----------
create table public.goals (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  account_id  uuid references public.accounts(id) on delete cascade,
  metric      text not null check (metric in ('net_pnl','win_rate','profit_factor','trade_count','max_risk','discipline')),
  period      text not null check (period in ('daily','weekly','monthly','yearly')),
  target      numeric(20,8) not null,
  starts_on   date not null default current_date,
  ends_on     date,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  constraint goal_period_valid check (ends_on is null or ends_on >= starts_on)
);

-- ---------- AI reviews ----------
create table public.ai_reviews (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  trade_id    uuid references public.trades(id) on delete cascade,
  scope       text not null check (scope in ('trade','screenshot','weekly','monthly')),
  model       text not null,
  input_hash  text not null,
  summary     text not null,
  findings    jsonb not null default '[]'::jsonb,
  scores      jsonb not null default '{}'::jsonb,
  token_cost  integer not null default 0,
  created_at  timestamptz not null default now()
);

-- Identical input must never be billed to the model twice.
create unique index ai_reviews_cache on public.ai_reviews (user_id, scope, input_hash);

-- ---------- billing ----------
create table public.plans (
  id            text primary key,
  name          text not null,
  tier          plan_tier not null,
  price_inr     integer not null check (price_inr >= 0),
  price_usd     integer not null check (price_usd >= 0),
  interval      text not null check (interval in ('month','year','once')),
  trade_limit   integer,
  account_limit integer,
  ai_credits    integer not null default 0,
  features      jsonb not null default '[]'::jsonb,
  is_active     boolean not null default true
);

create table public.subscriptions (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references public.profiles(id) on delete cascade,
  plan_id            text not null references public.plans(id),
  status             sub_status not null default 'trialing',
  provider           text not null check (provider in ('stripe','razorpay')),
  provider_ref       text,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create unique index subscriptions_one_active
  on public.subscriptions (user_id)
  where status in ('trialing','active','past_due');

create table public.import_batches (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  account_id   uuid not null references public.accounts(id) on delete cascade,
  source       text not null check (source in ('csv','excel','mt4','mt5','binance','bybit','okx','coinbase','manual')),
  filename     text,
  row_count    integer not null default 0,
  imported     integer not null default 0,
  skipped      integer not null default 0,
  errors       jsonb not null default '[]'::jsonb,
  created_at   timestamptz not null default now()
);

-- ---------- indexes ----------
-- The dashboard's hot query is "this user's closed trades in a date window".
create index trades_user_closed_at on public.trades (user_id, closed_at desc) where status = 'closed';
create index trades_account_opened on public.trades (account_id, opened_at desc);
create index trades_user_symbol    on public.trades (user_id, symbol);
create index trades_user_strategy  on public.trades (user_id, strategy_id) where strategy_id is not null;
create index trades_tags_gin       on public.trades using gin (tags);
create index screenshots_trade     on public.trade_screenshots (trade_id);
create index journal_user_date     on public.journal_entries (user_id, entry_date desc);
create index goals_user_active     on public.goals (user_id) where is_active;
create index accounts_user         on public.accounts (user_id) where not is_archived;

-- ---------- triggers ----------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['profiles','accounts','strategies','trades','journal_entries','subscriptions']
  loop
    execute format(
      'create trigger trg_%1$s_touch before update on public.%1$s
       for each row execute function public.touch_updated_at()', t);
  end loop;
end $$;

-- Keeps the stored P&L columns consistent with the source fields.
create or replace function public.derive_trade_pnl()
returns trigger language plpgsql as $$
declare
  mult numeric;
  sgn  integer;
  risk numeric;
begin
  mult := new.quantity * new.contract_size;
  sgn  := case when new.direction = 'long' then 1 else -1 end;

  if new.exit_price is null then
    new.gross_pnl := null;
    new.net_pnl   := null;
    new.r_multiple := null;
    return new;
  end if;

  new.gross_pnl := (new.exit_price - new.entry_price) * sgn * mult;
  new.net_pnl   := new.gross_pnl - new.fees - new.commission - new.swap;

  if new.stop_loss is null then
    new.r_multiple := null;
  else
    risk := abs(new.entry_price - new.stop_loss) * mult;
    new.r_multiple := case when risk = 0 then null else new.net_pnl / risk end;
  end if;

  return new;
end;
$$;

create trigger trg_trades_derive
  before insert or update on public.trades
  for each row execute function public.derive_trade_pnl();

-- New auth user gets a profile immediately; the app never has to create one.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- seed plans (reference data, not demo data) ----------
insert into public.plans (id, name, tier, price_inr, price_usd, interval, trade_limit, account_limit, ai_credits, features) values
  ('free',      'Free',      'free',     0,     0, 'month',  50, 1,   0, '["50 trades","1 account","Core analytics"]'),
  ('pro_month', 'Pro',       'pro',    999,    12, 'month', null, null, 200, '["Unlimited trades","Unlimited accounts","AI review","All imports","Reports"]'),
  ('pro_year',  'Pro Annual','pro',   7999,    99, 'year',  null, null, 3000, '["Everything in Pro","2 months free","Priority support"]'),
  ('lifetime',  'Lifetime',  'lifetime', 24999, 299, 'once', null, null, 5000, '["Everything in Pro","One-time payment","Lifetime updates"]');
