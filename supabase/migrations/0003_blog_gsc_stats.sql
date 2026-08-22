-- Store Search Console performance per blog post so content-refresh can
-- prioritise by real demand instead of by age.
--
-- Why this exists: the refresh cron picked the single oldest post by
-- updated_at. With 120 posts and one refresh per week, each post came up
-- roughly once every two years — useless as a freshness strategy, and it
-- spent that one slot on whatever happened to be oldest rather than on the
-- posts search demand is actually pointing at.
--
-- The signal that matters is impressions with a poor click rate: Google is
-- already showing the page to people who then don't click. Those are the
-- posts where a rewrite pays. A 90-day GSC export gives us exactly that.
--
-- Populated by scripts/ingest-gsc-stats.ts from the Search Console
-- "Pages" CSV export. Nothing here is required for the site to run — the
-- refresh cron falls back to age-based selection when the table is empty.
--
-- Apply via Supabase SQL editor or `supabase db push`.

CREATE TABLE IF NOT EXISTS blog_gsc_stats (
  slug          text PRIMARY KEY,
  clicks        integer NOT NULL DEFAULT 0,
  impressions   integer NOT NULL DEFAULT 0,
  ctr           real    NOT NULL DEFAULT 0,
  position      real,
  -- Start of the GSC reporting window this row came from, so a later import
  -- can tell stale rows from fresh ones.
  period_start  date,
  period_end    date,
  imported_at   timestamptz NOT NULL DEFAULT now()
);

-- The refresh cron's hot query is "highest impressions, worst CTR first".
CREATE INDEX IF NOT EXISTS idx_blog_gsc_stats_priority
  ON blog_gsc_stats (impressions DESC, ctr ASC);

COMMENT ON TABLE blog_gsc_stats IS
  'Search Console performance per blog slug. Imported from CSV; drives refresh prioritisation.';
COMMENT ON COLUMN blog_gsc_stats.ctr IS
  'Click-through rate as a fraction (0.0191 = 1.91%), matching the GSC export.';
