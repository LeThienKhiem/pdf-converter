-- Telemetry for the /admin performance dashboard.
--
-- The extractions log answered "did it work?" but not "why did it fail?",
-- "how long did it take?", or "what did it cost?" — the three questions that
-- decide whether a conversion funnel is healthy. These columns are all
-- nullable so existing rows stay valid.

alter table public.extractions
  add column if not exists error_code text,        -- truncated | parse_failed | ai_error | empty_response | no_data
  add column if not exists duration_ms integer,    -- end-to-end server time
  add column if not exists pages_total integer,    -- pages in the uploaded PDF
  add column if not exists pages_extracted integer,-- pages actually sent to the model
  add column if not exists model text,             -- which model served it
  add column if not exists input_tokens integer,
  add column if not exists output_tokens integer,
  add column if not exists rows_out integer;       -- rows returned to the user

create index if not exists extractions_created_idx on public.extractions (created_at desc);

-- Daily Search Console rollup for the dashboard's impressions chart.
-- Populated by /api/cron/gsc-daily when GSC credentials are configured;
-- the dashboard shows an empty state until then.
create table if not exists public.gsc_daily (
  date         date primary key,
  clicks       integer not null default 0,
  impressions  integer not null default 0,
  ctr          real    not null default 0,
  position     real,
  imported_at  timestamptz not null default now()
);

alter table public.gsc_daily enable row level security; -- service-role access only
