-- Monetization v2: plans, server-side usage tracking, atomic consumption, webhook idempotency.
--
-- Plans:
--   free       — 3 pages / 30-day window (rolling from usage_period_start)
--   week_pass  — one-time $2, unlimited* 7 days (soft cap 300 pages per pass)
--   pro        — $5/mo subscription, 200 pages / 30-day window
--   pro_yearly — $39/yr subscription, 200 pages / 30-day window
-- Legacy credit packs keep working: credits are consumed before the free quota.

-- ── users: plan columns ─────────────────────────────────────────────────────
alter table public.users
  add column if not exists plan text not null default 'free',
  add column if not exists plan_expires_at timestamptz,
  add column if not exists paddle_subscription_id text,
  add column if not exists founding_member boolean not null default false,
  add column if not exists pages_used integer not null default 0,
  add column if not exists usage_period_start timestamptz not null default now(),
  add column if not exists email_opt_out boolean not null default false,
  add column if not exists created_at timestamptz not null default now();

-- ── extractions: server-side usage log (funnel, power users, rate limiting) ─
create table if not exists public.extractions (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users (id) on delete set null,
  guest_key text,
  ip text,
  tool text not null default 'pdf-to-excel',
  status text not null default 'success', -- success | failed
  plan text,
  created_at timestamptz not null default now()
);
create index if not exists extractions_user_created_idx on public.extractions (user_id, created_at desc);
create index if not exists extractions_guest_key_idx on public.extractions (guest_key, created_at desc);
create index if not exists extractions_ip_created_idx on public.extractions (ip, created_at desc);

alter table public.extractions enable row level security; -- service-role access only

-- ── transactions: webhook idempotency ───────────────────────────────────────
create unique index if not exists transactions_paddle_tx_unique
  on public.transactions (paddle_transaction_id)
  where paddle_transaction_id is not null;

-- ── email drip log ──────────────────────────────────────────────────────────
create table if not exists public.email_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  email_type text not null, -- welcome | case_study | founding_offer
  sent_at timestamptz not null default now(),
  unique (user_id, email_type)
);
alter table public.email_log enable row level security;

-- ── atomic page/credit consumption ──────────────────────────────────────────
-- Single source of truth for "may this user extract one more page?".
-- Locks the user row, resolves plan windows, consumes one unit, and returns
-- a verdict. Order of consumption: active paid plan → legacy credits → free quota.
create or replace function public.consume_page(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  u record;
  v_plan text;
  v_cap integer;
begin
  select * into u from public.users where id = p_user_id for update;
  if not found then
    return jsonb_build_object('allowed', false, 'reason', 'user_not_found');
  end if;

  v_plan := u.plan;

  -- Expire a lapsed week pass.
  if v_plan = 'week_pass' and (u.plan_expires_at is null or u.plan_expires_at < now()) then
    update public.users set plan = 'free', plan_expires_at = null where id = p_user_id;
    v_plan := 'free';
  end if;

  -- Roll the 30-day usage window (free & pro plans).
  if v_plan in ('free', 'pro', 'pro_yearly') and u.usage_period_start < now() - interval '30 days' then
    update public.users set pages_used = 0, usage_period_start = now() where id = p_user_id;
    u.pages_used := 0;
  end if;

  -- 1. Active paid plan.
  if v_plan = 'week_pass' then
    v_cap := 300;
  elsif v_plan in ('pro', 'pro_yearly') then
    v_cap := 200;
  else
    v_cap := null;
  end if;

  if v_cap is not null then
    if u.pages_used < v_cap then
      update public.users set pages_used = pages_used + 1 where id = p_user_id;
      return jsonb_build_object('allowed', true, 'source', 'plan', 'plan', v_plan,
        'remaining', v_cap - u.pages_used - 1);
    end if;
    return jsonb_build_object('allowed', false, 'reason', 'quota_exceeded', 'plan', v_plan);
  end if;

  -- 2. Legacy credits.
  if coalesce(u.credits, 0) > 0 then
    update public.users set credits = credits - 1 where id = p_user_id;
    return jsonb_build_object('allowed', true, 'source', 'credits', 'plan', 'free',
      'remaining', u.credits - 1);
  end if;

  -- 3. Free monthly quota (3 pages / 30 days).
  if u.pages_used < 3 then
    update public.users set pages_used = pages_used + 1 where id = p_user_id;
    return jsonb_build_object('allowed', true, 'source', 'free_quota', 'plan', 'free',
      'remaining', 3 - u.pages_used - 1);
  end if;

  return jsonb_build_object('allowed', false, 'reason', 'quota_exceeded', 'plan', 'free');
end;
$$;

-- Refund one unit when extraction fails after consumption.
create or replace function public.refund_page(p_user_id uuid, p_source text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_source = 'credits' then
    update public.users set credits = credits + 1 where id = p_user_id;
  elsif p_source in ('plan', 'free_quota') then
    update public.users set pages_used = greatest(pages_used - 1, 0) where id = p_user_id;
  end if;
end;
$$;

revoke all on function public.consume_page(uuid) from public, anon, authenticated;
revoke all on function public.refund_page(uuid, text) from public, anon, authenticated;
