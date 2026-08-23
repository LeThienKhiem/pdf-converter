-- Track which blog posts have been syndicated to which platform.
--
-- The syndicate cron was written to post each new article to dev.to, Hashnode
-- and Medium with a canonical URL pointing back here — a legitimate, free
-- backlink from a high-authority domain. Two things stopped it being useful:
--
--   1. It was never registered anywhere. Not in vercel.json, not dispatched
--      from the master cron. It had never run.
--   2. It looked only at posts created in the last 24 hours. The real publish
--      cadence is roughly one post every four days, so even once wired up it
--      would have found nothing on most days — and with no record of what it
--      had already posted, running twice in a day would double-publish.
--
-- Tracking per (post, platform) fixes both and unlocks the backlog: 120 posts
-- already exist and none have been syndicated. Working through them at one a
-- day yields three links a day from content that is already written.
--
-- Granularity is per-platform on purpose. When dev.to succeeds and Medium
-- times out, the next run should retry Medium only, not re-post to dev.to.
--
-- Apply via Supabase SQL editor or `supabase db push`.

CREATE TABLE IF NOT EXISTS blog_syndications (
  id            bigserial PRIMARY KEY,
  blog_slug     text NOT NULL,
  platform      text NOT NULL CHECK (platform IN ('devto', 'hashnode', 'medium')),
  -- 'published' is terminal. 'failed' is retryable — the cron will pick it up
  -- again. 'skipped' means the platform has no credentials configured, so
  -- there is nothing to retry until they are added.
  status        text NOT NULL CHECK (status IN ('published', 'failed', 'skipped')),
  external_url  text,
  error         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- One row per post per platform. The cron upserts on this, which is what makes
-- a double-run idempotent rather than a double-publish.
CREATE UNIQUE INDEX IF NOT EXISTS idx_blog_syndications_unique
  ON blog_syndications (blog_slug, platform);

-- The cron's hot query is "what have I already published for these slugs".
CREATE INDEX IF NOT EXISTS idx_blog_syndications_lookup
  ON blog_syndications (blog_slug, status);

COMMENT ON TABLE blog_syndications IS
  'One row per (blog post, platform) syndication attempt. Prevents double-posting and drives the daily backlog.';
COMMENT ON COLUMN blog_syndications.status IS
  'published = terminal; failed = retryable; skipped = no credentials for that platform yet.';
