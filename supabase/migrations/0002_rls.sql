-- ============================================================
-- Row Level Security
-- Default posture: deny. Every table below is owner-scoped on user_id.
-- ============================================================

alter table public.profiles          enable row level security;
alter table public.accounts          enable row level security;
alter table public.strategies        enable row level security;
alter table public.trades            enable row level security;
alter table public.trade_screenshots enable row level security;
alter table public.journal_entries   enable row level security;
alter table public.goals             enable row level security;
alter table public.ai_reviews        enable row level security;
alter table public.subscriptions     enable row level security;
alter table public.import_batches    enable row level security;
alter table public.plans             enable row level security;

-- Role check runs as definer so a user cannot read the profiles table to
-- escalate, and is stable so the planner calls it once per statement.
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ---------- profiles ----------
create policy "own profile: read"   on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy "own profile: update" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
-- No insert policy: profiles are created only by the auth trigger.
-- No delete policy: account deletion cascades from auth.users.

-- ---------- owner-scoped tables ----------
do $$
declare t text;
begin
  foreach t in array array[
    'accounts','strategies','trades','trade_screenshots',
    'journal_entries','goals','ai_reviews','import_batches'
  ]
  loop
    execute format($p$
      create policy "owner: select" on public.%1$s
        for select using (user_id = auth.uid() or public.is_admin());
      create policy "owner: insert" on public.%1$s
        for insert with check (user_id = auth.uid());
      create policy "owner: update" on public.%1$s
        for update using (user_id = auth.uid()) with check (user_id = auth.uid());
      create policy "owner: delete" on public.%1$s
        for delete using (user_id = auth.uid());
    $p$, t);
  end loop;
end $$;

-- ---------- billing ----------
-- Read-only to the user. Writes come from webhooks on the service role,
-- which bypasses RLS — a client must never be able to grant itself a plan.
create policy "subscription: read own" on public.subscriptions
  for select using (user_id = auth.uid() or public.is_admin());

create policy "plans: public read" on public.plans
  for select using (is_active or public.is_admin());

-- ---------- cross-table integrity ----------
-- RLS stops a user reading another user's rows, but not writing a trade that
-- points at someone else's account. This closes that gap.
create or replace function public.assert_owned_account()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from public.accounts
    where id = new.account_id and user_id = new.user_id
  ) then
    raise exception 'account % does not belong to user %', new.account_id, new.user_id
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger trg_trades_account_owner
  before insert or update of account_id on public.trades
  for each row execute function public.assert_owned_account();

-- ---------- storage ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('screenshots', 'screenshots', false, 10485760, array['image/png','image/jpeg','image/webp']),
  ('avatars',     'avatars',     true,   2097152, array['image/png','image/jpeg','image/webp'])
on conflict (id) do nothing;

-- Path convention: screenshots/<user_id>/<trade_id>/<file>.
-- The first path segment is the owner, so it is the whole authorization check.
create policy "screenshots: owner read" on storage.objects
  for select using (
    bucket_id = 'screenshots' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "screenshots: owner write" on storage.objects
  for insert with check (
    bucket_id = 'screenshots' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "screenshots: owner delete" on storage.objects
  for delete using (
    bucket_id = 'screenshots' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars: public read" on storage.objects
  for select using (bucket_id = 'avatars');

create policy "avatars: owner write" on storage.objects
  for insert with check (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );
