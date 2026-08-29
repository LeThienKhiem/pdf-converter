/**
 * Record dev.to articles that already exist, so the queue starts from reality.
 *
 * The account had 34 articles published with correct canonical URLs before any
 * of this tracking existed. The first live cron run therefore tried to
 * re-publish the top-impression post, got 422 "Canonical url has already been
 * taken", and logged a failure — for a backlink that was already in place.
 *
 * Without this backfill the cron would re-discover that fact one post per day,
 * burning a run each time. Matching dev.to's canonical_url back to our slugs
 * writes those rows up front.
 *
 * Idempotent: upserts on (blog_slug, platform), so re-running is harmless.
 *
 * Usage:
 *   npx tsx scripts/backfill-devto-syndications.ts --dry-run
 *   npx tsx scripts/backfill-devto-syndications.ts
 */

import * as fs from "fs";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";

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

const DRY_RUN = process.argv.includes("--dry-run");

/** Pull the blog slug out of a canonical URL, ignoring host and protocol. */
function slugFromCanonical(url: string | undefined): string | null {
  if (!url) return null;
  return url.match(/\/blog\/([^/?#]+)/)?.[1] ?? null;
}

async function run() {
  console.log(`Mode: ${DRY_RUN ? "DRY-RUN (no writes)" : "APPLY"}\n`);

  const apiKey = process.env.DEVTO_API_KEY;
  if (!apiKey) {
    console.error("DEVTO_API_KEY not set.");
    process.exit(1);
  }

  const res = await fetch("https://dev.to/api/articles/me/all?per_page=1000", {
    headers: { "api-key": apiKey },
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) {
    console.error(`dev.to HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
    process.exit(1);
  }
  const articles = (await res.json()) as {
    title?: string;
    url?: string;
    canonical_url?: string;
    published?: boolean;
  }[];
  console.log(`dev.to articles on the account: ${articles.length}`);

  const { data: blogRows, error: blogErr } = await supabase
    .from("blogs")
    .select("slug")
    .limit(10000);
  if (blogErr) {
    console.error(`Could not read blogs: ${blogErr.message}`);
    process.exit(1);
  }
  const knownSlugs = new Set((blogRows ?? []).map((b: { slug: string }) => b.slug));

  const matched: { slug: string; url: string; title: string }[] = [];
  const unmatched: string[] = [];

  for (const a of articles) {
    const slug = slugFromCanonical(a.canonical_url);
    // Only record posts that still exist here — a canonical pointing at a
    // deleted post is not a link into the current site.
    if (!slug || !knownSlugs.has(slug)) {
      unmatched.push(a.canonical_url ?? a.title ?? "(no canonical)");
      continue;
    }
    matched.push({ slug, url: a.url ?? "", title: a.title ?? "" });
  }

  console.log(`  matched to a current post: ${matched.length}`);
  console.log(`  no matching post:          ${unmatched.length}`);
  for (const u of unmatched.slice(0, 5)) console.log(`      ${u.slice(0, 90)}`);
  if (unmatched.length > 5) console.log(`      ...and ${unmatched.length - 5} more`);

  console.log(`\nWould record as already-published on dev.to:`);
  for (const m of matched.slice(0, 10)) {
    console.log(`  ${m.title.slice(0, 58)}`);
    console.log(`    ${m.slug.slice(0, 70)}`);
  }
  if (matched.length > 10) console.log(`  ...and ${matched.length - 10} more`);

  if (DRY_RUN) {
    console.log("\nDry-run — no writes.");
    return;
  }
  if (matched.length === 0) {
    console.log("\nNothing to record.");
    return;
  }

  const { error } = await supabase.from("blog_syndications").upsert(
    matched.map((m) => ({
      blog_slug: m.slug,
      platform: "devto",
      status: "published",
      external_url: m.url,
      error: null,
      updated_at: new Date().toISOString(),
    })),
    { onConflict: "blog_slug,platform" }
  );
  if (error) {
    console.error(`\nUpsert failed: ${error.message}`);
    process.exit(1);
  }

  const { count } = await supabase
    .from("blog_syndications")
    .select("*", { count: "exact", head: true })
    .eq("platform", "devto")
    .eq("status", "published");

  console.log(`\nRecorded ${matched.length} article(s).`);
  console.log(`dev.to now shows ${count ?? "?"} published row(s) — the queue will skip these.`);
}

run();
