-- ============================================================
-- Two bugs that only appear once something writes a subscription
-- ============================================================

-- 1. The unique index was partial (active statuses only), so
--    `on conflict (user_id)` matched nothing and every upsert failed with
--    42P10. One row per user is the rule regardless of status, so the index
--    should be unconditional.
drop index if exists public.subscriptions_one_active;

create unique index if not exists subscriptions_one_per_user
  on public.subscriptions (user_id);

-- 2. The provider check predated crypto, so a crypto payment could not be
--    recorded truthfully — it had to be filed as something it was not.
alter table public.subscriptions
  drop constraint if exists subscriptions_provider_check;

alter table public.subscriptions
  add constraint subscriptions_provider_check
  check (provider in ('stripe', 'razorpay', 'crypto', 'manual'));
