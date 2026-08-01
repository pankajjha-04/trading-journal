-- ============================================================
-- Fixes found while running the product
-- ============================================================

-- ON CONFLICT cannot match a partial unique index unless the same WHERE
-- clause is restated, and the Supabase client has no way to pass it. The
-- plain index behaves identically for dedupe: Postgres treats NULLs as
-- distinct, so rows without an external_id are still unconstrained.
drop index if exists public.trades_external_dedupe;

create unique index if not exists trades_external_dedupe
  on public.trades (account_id, external_id);

-- Broker names were stored exactly as typed, so "binance" and "Binance"
-- read as different brokers in the UI.
create or replace function public.normalise_broker()
returns trigger language plpgsql as $$
begin
  if new.broker is not null then
    new.broker := btrim(new.broker);
    if new.broker = '' then
      new.broker := null;
    else
      -- Title case each word: "binance futures" becomes "Binance Futures".
      new.broker := initcap(new.broker);
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_accounts_broker on public.accounts;

create trigger trg_accounts_broker
  before insert or update of broker on public.accounts
  for each row execute function public.normalise_broker();

update public.accounts
set broker = initcap(btrim(broker))
where broker is not null and broker <> initcap(btrim(broker));
