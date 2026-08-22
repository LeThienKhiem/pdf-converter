/**
 * Import a Search Console "Pages" CSV export into blog_gsc_stats.
 *
 * The refresh cron uses this to target posts where Google is already showing
 * the page but nobody clicks — the cases where a rewrite actually pays —
 * instead of just picking whatever post is oldest.
 *
 * Getting the CSV: Search Console -> Performance -> Pages tab -> Export ->
 * CSV. The download contains Pages.csv. Any date range works; 3 months is a
 * good default.
 *
 * Usage:
 *   npx tsx scripts/ingest-gsc-stats.ts <path-to-Pages.csv> [--dry-run]
 *
 * Re-running replaces existing rows for the same slugs, so importing a fresh
 * export each month keeps the table current.
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

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const csvPath = args.find((a) => !a.startsWith("--"));

if (!csvPath) {
  console.error("Usage: npx tsx scripts/ingest-gsc-stats.ts <path-to-Pages.csv> [--dry-run]");
  process.exit(1);
}
if (!fs.existsSync(csvPath)) {
  console.error(`File not found: ${csvPath}`);
  process.exit(1);
}

/**
 * Split one CSV line, honouring double-quoted fields. GSC quotes any value
 * containing a comma, and long query strings routinely do.
 */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

/** Pull the blog slug out of a full GSC page URL, or null for non-blog pages. */
function slugFromUrl(url: string): string | null {
  const match = url.match(/\/blog\/([^/?#]+)/);
  return match ? match[1] : null;
}

type StatRow = {
  slug: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number | null;
};

async function run() {
  const raw = fs.readFileSync(csvPath!, "utf-8");
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    console.error("CSV has no data rows.");
    process.exit(1);
  }

  // Header is like: "Top pages,Clicks,Impressions,CTR,Position"
  const header = splitCsvLine(lines[0]).map((h) => h.toLowerCase());
  const idx = {
    url: 0,
    clicks: header.findIndex((h) => h.includes("click")),
    impressions: header.findIndex((h) => h.includes("impression")),
    ctr: header.findIndex((h) => h === "ctr"),
    position: header.findIndex((h) => h.includes("position")),
  };
  if (idx.clicks === -1 || idx.impressions === -1) {
    console.error(`Unexpected CSV header: ${lines[0]}`);
    console.error("Expected a Search Console Pages export with Clicks and Impressions columns.");
    process.exit(1);
  }

  // Collapse www / non-www duplicates of the same slug by summing them —
  // GSC reports them as separate rows but they are one post.
  const bySlug = new Map<string, StatRow>();
  let nonBlogRows = 0;

  for (const line of lines.slice(1)) {
    const cells = splitCsvLine(line);
    const slug = slugFromUrl(cells[idx.url] ?? "");
    if (!slug) {
      nonBlogRows++;
      continue;
    }
    const clicks = Number(cells[idx.clicks] ?? 0) || 0;
    const impressions = Number(cells[idx.impressions] ?? 0) || 0;
    const position = idx.position >= 0 ? Number(cells[idx.position]) || null : null;

    const existing = bySlug.get(slug);
    if (existing) {
      existing.clicks += clicks;
      existing.impressions += impressions;
      // Impression-weighted average keeps the combined position honest.
      if (position !== null && existing.position !== null) {
        const total = existing.impressions + impressions;
        existing.position =
          total > 0
            ? (existing.position * existing.impressions + position * impressions) / total
            : position;
      }
      existing.ctr = existing.impressions > 0 ? existing.clicks / existing.impressions : 0;
    } else {
      bySlug.set(slug, {
        slug,
        clicks,
        impressions,
        ctr: impressions > 0 ? clicks / impressions : 0,
        position,
      });
    }
  }

  const rows = [...bySlug.values()];
  console.log(`Parsed ${lines.length - 1} CSV rows`);
  console.log(`  blog posts:     ${rows.length}`);
  console.log(`  skipped (non-blog URLs): ${nonBlogRows}`);

  // Only keep slugs that actually exist, so a stale export can't create
  // orphan rows the refresh cron would then try to act on.
  const { data: blogRows, error: blogErr } = await supabase
    .from("blogs")
    .select("slug")
    .limit(10000);
  if (blogErr) {
    console.error("Could not read blogs table:", blogErr.message);
    process.exit(1);
  }
  const known = new Set((blogRows ?? []).map((b: { slug: string }) => b.slug));
  const matched = rows.filter((r) => known.has(r.slug));
  const unmatched = rows.filter((r) => !known.has(r.slug));

  console.log(`  matched to existing posts: ${matched.length}`);
  if (unmatched.length > 0) {
    console.log(`  no matching post (ignored): ${unmatched.length}`);
    for (const u of unmatched.slice(0, 5)) console.log(`      ${u.slug}`);
    if (unmatched.length > 5) console.log(`      ...and ${unmatched.length - 5} more`);
  }

  // Show what the refresh cron would prioritise.
  const priority = [...matched]
    .filter((r) => r.impressions >= 20)
    .sort((a, b) => a.ctr - b.ctr || b.impressions - a.impressions)
    .slice(0, 10);
  console.log(`\nTop refresh candidates (>=20 impressions, worst CTR first):`);
  for (const p of priority) {
    console.log(
      `  ${String(p.impressions).padStart(5)} imp  ${(p.ctr * 100).toFixed(2).padStart(5)}% ctr  pos ${p.position?.toFixed(1) ?? "?"}  ${p.slug.slice(0, 60)}`
    );
  }

  if (DRY_RUN) {
    console.log("\nDry-run — nothing written.");
    return;
  }

  const { error } = await supabase.from("blog_gsc_stats").upsert(
    matched.map((r) => ({
      slug: r.slug,
      clicks: r.clicks,
      impressions: r.impressions,
      ctr: r.ctr,
      position: r.position,
      imported_at: new Date().toISOString(),
    })),
    { onConflict: "slug" }
  );

  if (error) {
    console.error("\nUpsert failed:", error.message);
    console.error("If the table is missing, apply supabase/migrations/0003_blog_gsc_stats.sql first.");
    process.exit(1);
  }
  console.log(`\nWrote ${matched.length} rows to blog_gsc_stats.`);
}

run();
