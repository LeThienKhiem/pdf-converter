/**
 * Read-only diagnostic: measure duplication in the auto-generated blog corpus.
 *
 * Answers four questions:
 *   1. How big is the corpus vs the 30-post dedup window?
 *   2. How many posts have a NULL/empty summary (weak dedup signal)?
 *   3. What's the real publish cadence?
 *   4. Which title pairs are near-duplicates — and were they OUTSIDE each
 *      other's 30-post window at generation time (i.e. the window is the cause)?
 *
 * Usage: npx tsx scripts/audit-blog-dupes.ts
 */

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""
);

const DEDUP_WINDOW = 30; // mirrors .limit(30) in the seo-content crons

// Words too generic to signal topical overlap in this corpus.
const STOP = new Set([
  "the", "a", "an", "and", "or", "for", "to", "of", "in", "on", "with", "your",
  "you", "how", "what", "why", "is", "are", "vs", "best", "top", "guide", "2026",
  "2025", "2024", "it", "that", "this", "from", "at", "by", "as", "be", "can",
  "complete", "ultimate", "step", "steps", "into", "not", "no", "my", "our",
]);

function tokens(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP.has(w))
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const w of a) if (b.has(w)) inter++;
  return inter / (a.size + b.size - inter);
}

type Row = {
  title: string;
  slug: string;
  summary: string | null;
  created_at: string;
};

async function run() {
  const { data, error } = await supabase
    .from("blogs")
    .select("title, slug, summary, created_at")
    .order("created_at", { ascending: false })
    .limit(10000);

  if (error) {
    console.error("Query failed:", error.message);
    process.exit(1);
  }
  const rows = (data ?? []) as Row[];

  // ── 1. Corpus size vs dedup window ────────────────────────────────────
  console.log("=".repeat(72));
  console.log("1. CORPUS SIZE vs DEDUP WINDOW");
  console.log("=".repeat(72));
  console.log(`Total posts:        ${rows.length}`);
  console.log(`Dedup window:       ${DEDUP_WINDOW} most recent`);
  const blind = Math.max(0, rows.length - DEDUP_WINDOW);
  console.log(`INVISIBLE to gate:  ${blind} posts (${((blind / rows.length) * 100).toFixed(1)}%)`);

  // ── 2. Summary coverage ───────────────────────────────────────────────
  console.log("\n" + "=".repeat(72));
  console.log("2. SUMMARY COVERAGE (dedup signal quality)");
  console.log("=".repeat(72));
  const noSummary = rows.filter((r) => !r.summary?.trim());
  console.log(`Posts WITHOUT summary: ${noSummary.length} / ${rows.length}`);
  const windowRows = rows.slice(0, DEDUP_WINDOW);
  const windowNoSummary = windowRows.filter((r) => !r.summary?.trim()).length;
  console.log(`  ...within the active ${DEDUP_WINDOW}-post window: ${windowNoSummary}`);
  console.log("  (title-only entries give the planner a much weaker signal)");

  // ── 3. Publish cadence ────────────────────────────────────────────────
  // The cron ticks daily; 6 of 7 ticks should publish (Sunday = refresh only).
  // Measuring against calendar days — not "days that happen to have a post" —
  // is what exposes how often a run bails out with nothing.
  console.log("\n" + "=".repeat(72));
  console.log("3. PUBLISH CADENCE");
  console.log("=".repeat(72));
  const newest = new Date(rows[0].created_at);
  const oldest = new Date(rows[rows.length - 1].created_at);
  const spanDays = Math.round((+newest - +oldest) / 86400000);
  const expected = (spanDays * 6) / 7;
  console.log(`Range:        ${rows[rows.length - 1].created_at.slice(0, 10)} -> ${rows[0].created_at.slice(0, 10)} (${spanDays} days)`);
  console.log(`Actual rate:  ${(rows.length / spanDays).toFixed(2)} posts/day = 1 post every ${(spanDays / rows.length).toFixed(1)} days`);
  console.log(`Expected:     ${expected.toFixed(0)} posts if every non-Sunday run published`);
  console.log(`Fill rate:    ${((rows.length / expected) * 100).toFixed(0)}%  =>  ~${(100 - (rows.length / expected) * 100).toFixed(0)}% of runs published NOTHING`);

  const cutoff = +newest - 60 * 86400000;
  const last60 = rows.filter((r) => +new Date(r.created_at) >= cutoff);
  console.log(`\nLast 60 days: ${last60.length} posts = 1 every ${(60 / last60.length).toFixed(1)} days`);

  const gaps: { gap: number; from: string; to: string }[] = [];
  for (let i = 0; i < rows.length - 1; i++) {
    gaps.push({
      gap: Math.round((+new Date(rows[i].created_at) - +new Date(rows[i + 1].created_at)) / 86400000),
      from: rows[i + 1].created_at.slice(0, 10),
      to: rows[i].created_at.slice(0, 10),
    });
  }
  gaps.sort((a, b) => b.gap - a.gap);
  console.log(`\nLargest silent gaps:`);
  for (const g of gaps.slice(0, 8)) {
    console.log(`  ${String(g.gap).padStart(3)} days: ${g.from} -> ${g.to}`);
  }

  // ── 4. Near-duplicate pairs ───────────────────────────────────────────
  console.log("\n" + "=".repeat(72));
  console.log("4. NEAR-DUPLICATE TITLE PAIRS (Jaccard >= 0.40 on content words)");
  console.log("=".repeat(72));
  const toks = rows.map((r) => tokens(r.title));
  type Pair = { i: number; j: number; score: number; gap: number; outsideWindow: boolean };
  const pairs: Pair[] = [];
  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      const score = jaccard(toks[i], toks[j]);
      if (score >= 0.4) {
        // `rows` is newest-first, so j-i is how many posts apart they were.
        // If the older one sat beyond the window when the newer was written,
        // the gate literally could not see it.
        const gap = j - i;
        pairs.push({ i, j, score, gap, outsideWindow: gap >= DEDUP_WINDOW });
      }
    }
  }
  pairs.sort((a, b) => b.score - a.score);

  console.log(`Found ${pairs.length} near-duplicate pair(s)\n`);
  for (const p of pairs.slice(0, 25)) {
    const flag = p.outsideWindow ? "WINDOW MISS" : "in-window";
    console.log(`[${(p.score * 100).toFixed(0)}% overlap] gap=${p.gap} posts — ${flag}`);
    console.log(`   newer: ${rows[p.i].title}`);
    console.log(`          ${rows[p.i].created_at.slice(0, 10)}  /${rows[p.i].slug}`);
    console.log(`   older: ${rows[p.j].title}`);
    console.log(`          ${rows[p.j].created_at.slice(0, 10)}  /${rows[p.j].slug}`);
    console.log();
  }

  const missed = pairs.filter((p) => p.outsideWindow).length;
  console.log("-".repeat(72));
  console.log(`Pairs the ${DEDUP_WINDOW}-post window COULD NOT see: ${missed} / ${pairs.length}`);
  console.log(`Pairs generated despite being visible:              ${pairs.length - missed}`);

  // ── 5. Most-repeated content words ────────────────────────────────────
  console.log("\n" + "=".repeat(72));
  console.log("5. MOST-REPEATED TITLE WORDS (topic concentration)");
  console.log("=".repeat(72));
  const freq = new Map<string, number>();
  for (const t of toks) for (const w of t) freq.set(w, (freq.get(w) ?? 0) + 1);
  const top = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);
  for (const [w, n] of top) {
    console.log(`  ${String(n).padStart(3)}x  ${w}  ${((n / rows.length) * 100).toFixed(0)}% of posts`);
  }
}

run();
