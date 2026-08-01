-- ============================================================
-- Payments and invoices
-- ============================================================

create type payment_status as enum ('pending', 'paid', 'failed', 'refunded');
create type payment_provider as enum ('stripe', 'razorpay', 'crypto');

create table if not exists public.payments (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  plan_id       text not null references public.plans(id),
  provider      payment_provider not null,
  provider_ref  text,
  status        payment_status not null default 'pending',
  amount_minor  integer not null check (amount_minor >= 0),
  currency      char(3) not null default 'INR',
  -- The provider's own event id. Webhooks are retried, sometimes for days;
  -- without this a retry would grant a second subscription period.
  event_id      text,
  raw           jsonb,
  created_at    timestamptz not null default now()
);

create unique index if not exists payments_event_dedupe
  on public.payments (provider, event_id)
  where event_id is not null;

create index if not exists payments_user on public.payments (user_id, created_at desc);

create table if not exists public.invoices (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  payment_id    uuid references public.payments(id) on delete set null,
  number        text not null unique,
  issued_on     date not null default current_date,
  subtotal_minor integer not null,
  tax_minor      integer not null default 0,
  total_minor    integer not null,
  currency      char(3) not null default 'INR',
  tax_label     text,
  place_of_supply text,
  created_at    timestamptz not null default now()
);

create index if not exists invoices_user on public.invoices (user_id, issued_on desc);

alter table public.payments enable row level security;
alter table public.invoices enable row level security;

-- Read-only to the owner. Every write comes from a webhook running on the
-- service role, because a client that can insert a paid payment can grant
-- itself any plan it likes.
create policy "payments: read own" on public.payments
  for select using (user_id = auth.uid() or public.is_admin());

create policy "invoices: read own" on public.invoices
  for select using (user_id = auth.uid() or public.is_admin());

-- Sequential invoice numbers per Indian financial year (April to March).
create sequence if not exists invoice_seq;

create or replace function public.next_invoice_number()
returns text language plpgsql as $$
declare
  fy_start int;
  fy text;
begin
  fy_start := case when extract(month from current_date) >= 4
                   then extract(year from current_date)
                   else extract(year from current_date) - 1 end;
  fy := to_char(fy_start, 'FM0000') || '-' || to_char((fy_start + 1) % 100, 'FM00');
  return 'LL/' || fy || '/' || lpad(nextval('invoice_seq')::text, 5, '0');
end;
$$;
