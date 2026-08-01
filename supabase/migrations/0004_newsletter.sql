-- Waitlist / newsletter signups from the marketing page.
create table if not exists public.newsletter_subscribers (
  id           uuid primary key default gen_random_uuid(),
  email        citext not null unique,
  source       text not null default 'landing',
  confirmed_at timestamptz,
  created_at   timestamptz not null default now()
);

alter table public.newsletter_subscribers enable row level security;

-- Anyone may subscribe; nobody but an admin may read the list. Without the
-- missing select policy this table would be a public email dump.
create policy "newsletter: anyone can subscribe" on public.newsletter_subscribers
  for insert with check (true);

create policy "newsletter: admin reads" on public.newsletter_subscribers
  for select using (public.is_admin());

create index if not exists newsletter_created on public.newsletter_subscribers (created_at desc);
