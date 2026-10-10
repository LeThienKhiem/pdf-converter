-- Paywall funnel events, recorded server-side.
--
-- The paywall had no click-level visibility: GA events go through Firebase,
-- whose API key is currently rejected, so we could see that someone reached
-- the paywall and that nobody paid, but nothing in between. These rows fill
-- that gap: offer shown, Google sign-in clicked, checkout opened, payment
-- details entered, paid — enough to say which step loses people.
--
-- No personal data: person identity is the opaque guest cookie and/or the
-- account id, the same identifiers the extractions log already holds.

create table if not exists public.funnel_events (
  id bigint generated always as identity primary key,
  event text not null,
  variant text,              -- paywall variant: pages_limit, download_signin, ...
  tool text,                 -- pdf-to-excel, bank-statement-to-excel, ...
  source text,               -- where a checkout was opened from
  pages_total integer,
  user_id uuid references auth.users (id) on delete set null,
  guest_key text,
  ip text,
  path text,
  created_at timestamptz not null default now()
);

create index if not exists funnel_events_created_idx on public.funnel_events (created_at desc);
create index if not exists funnel_events_event_created_idx on public.funnel_events (event, created_at desc);

alter table public.funnel_events enable row level security; -- service-role access only
