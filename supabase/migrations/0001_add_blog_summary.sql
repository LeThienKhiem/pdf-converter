-- Layer 1 dedup gate: store a short summary alongside every blog post so the
-- pre-generation similarity check can compare the candidate angle against
-- compact snapshots of the corpus instead of full article bodies.
--
-- Rationale: feeding 30 full articles into a Haiku similarity scorer would
-- cost ~50k input tokens per cron run. Feeding 30 summaries (~80 words each)
-- costs ~2.5k tokens — ~20x cheaper for the same dedup signal.
--
-- Apply via Supabase SQL editor or `supabase db push`.

ALTER TABLE blogs
  ADD COLUMN IF NOT EXISTS summary text;

-- Partial index to make the backfill route's "find posts without summary"
-- query O(log n) instead of a full table scan once the table grows.
CREATE INDEX IF NOT EXISTS idx_blogs_summary_null
  ON blogs (created_at DESC)
  WHERE summary IS NULL;
