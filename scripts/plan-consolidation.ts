/**
 * Build a winner/loser consolidation plan for near-duplicate blog posts.
 *
 * Read-only. Produces a proposed redirect map for review — it does not touch
 * the database or any route.
 *
 * Why consolidate rather than just delete: three thin posts competing for one
 * keyword each stall around position 10-12, splitting clicks and internal
 * links between them. Redirecting the losers into the strongest one
 * concentrates that signal on a single URL, which is what actually moves it
 * up the page.
 *
 * Winner selection, in order:
 *   1. Most clicks (proven to convert impressions)
 *   2. Most impressions (proven reach)
 *   3. Best average position
 *   4. Longest article (most salvageable substance)
 *
 * Performance data comes from blog_gsc_stats when it is populated, or
 * straight from a Search Console Pages CSV via --csv. The CSV path exists so
 * this analysis doesn't have to wait on the migration being applied.
 * Falls back to content length alone where a post has no GSC row either way.
 *
 * Usage:
 *   npx tsx scripts/plan-consolidation.ts
 *   npx tsx scripts/plan-consolidation.ts --csv path/to/Pages.csv
 *   npx tsx scripts/plan-consolidation.ts --json
 */

import * as fs from "fs";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";
import { areDuplicateTitles, boilerplateTokens } from "../lib/seoContent";

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

const AS_JSON = process.argv.includes("--json");
const csvFlag = process.argv.indexOf("--csv");
const CSV_PATH = csvFlag !== -1 ? process.argv[csvFlag + 1] : null;


/** Split a CSV line, honouring double-quoted fields (GSC quotes commas). */
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
      } else inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

type Stat = { clicks: number; impressions: number; position: number | null };

/**
 * Read a Search Console Pages export into per-slug stats, summing the
 * www and non-www rows GSC reports separately for the same post.
 */
function statsFromCsv(file: string): Map<string, Stat> {
  const out = new Map<string, Stat>();
  const lines = fs.readFileSync(file, "utf-8").split(/\r?\n/).filter((l) => l.trim());
  const header = splitCsvLine(lines[0]).map((h) => h.toLowerCase());
  const iClicks = header.findIndex((h) => h.includes("click"));
  const iImp = header.findIndex((h) => h.includes("impression"));
  const iPos = header.findIndex((h) => h.includes("position"));

  for (const line of lines.slice(1)) {
    const cells = splitCsvLine(line);
    const slug = cells[0]?.match(/\/blog\/([^/?#]+)/)?.[1];
    if (!slug) continue;
    const clicks = Number(cells[iClicks]) || 0;
    const impressions = Number(cells[iImp]) || 0;
    const position = iPos >= 0 ? Number(cells[iPos]) || null : null;

    const prev = out.get(slug);
    if (prev) {
      const total = prev.impressions + impressions;
      if (position !== null && prev.position !== null && total > 0) {
        prev.position =
          (prev.position * prev.impressions + position * impressions) / total;
      }
      prev.clicks += clicks;
      prev.impressions += impressions;
    } else {
      out.set(slug, { clicks, impressions, position });
    }
  }
  return out;
}

type Post = {
  slug: string;
  title: string;
  content: string | null;
  created_at: string;
  clicks: number;
  impressions: number;
  position: number | null;
  hasStats: boolean;
};

/**
 * Group posts that are genuinely the same article.
 *
 * Uses areDuplicateTitles() — the same entity-aware predicate the publish
 * gate uses — rather than raw title overlap.
 *
 * A first version of this clustered on plain Jaccard >= 0.4 with transitive
 * union-find and produced a single 19-post cluster: every "InvoiceToData vs
 * <competitor>" article chained into one group through the shared
 * "invoicetodata / invoice / ocr" scaffolding. Acting on that would have
 * 301'd eighteen legitimately distinct comparisons into one page. Requiring
 * that neither title brings a distinctive term the other lacks keeps
 * "vs Mindee" and "vs Veryfi" apart, which is the correct answer.
 *
 * Transitivity is kept — a true duplicate of a duplicate is still the same
 * article — but the far stricter predicate stops it running away.
 */
function cluster(posts: Post[]): Post[][] {
  const boilerplate = boilerplateTokens(posts.map((p) => p.title));

  const parent = posts.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const union = (i: number, j: number) => {
    parent[find(i)] = find(j);
  };

  for (let i = 0; i < posts.length; i++) {
    for (let j = i + 1; j < posts.length; j++) {
      if (areDuplicateTitles(posts[i].title, posts[j].title, boilerplate)) {
        union(i, j);
      }
    }
  }

  const groups = new Map<number, Post[]>();
  for (let i = 0; i < posts.length; i++) {
    const root = find(i);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root)!.push(posts[i]);
  }
  return [...groups.values()].filter((g) => g.length > 1);
}

/**
 * Impressions only count as evidence above this, and only when the gap
 * between two posts is at least this wide.
 *
 * Without it, a 7-vs-6 impression difference decided a cluster and handed the
 * win to a 1399-word post at position 9.7 over a 2637-word post at position
 * 4.7. At single-digit volumes that difference is noise, not a signal, and
 * ranking plus substance are the better evidence.
 */
const MATERIAL_IMPRESSIONS = 30;

function pickWinner(group: Post[]): Post {
  return [...group].sort((a, b) => {
    // Clicks are a real conversion signal at any volume.
    if (b.clicks !== a.clicks) return b.clicks - a.clicks;

    const impressionsAreMeaningful =
      Math.max(a.impressions, b.impressions) >= MATERIAL_IMPRESSIONS &&
      Math.abs(a.impressions - b.impressions) >= MATERIAL_IMPRESSIONS;
    if (impressionsAreMeaningful) return b.impressions - a.impressions;

    // Otherwise let ranking decide, then substance.
    const pa = a.position ?? 999;
    const pb = b.position ?? 999;
    if (Math.abs(pa - pb) >= 1) return pa - pb;

    return (b.content?.length ?? 0) - (a.content?.length ?? 0);
  })[0];
}

async function run() {
  const { data: blogRows, error: blogErr } = await supabase
    .from("blogs")
    .select("slug, title, content, created_at")
    .limit(10000);
  if (blogErr) {
    console.error("Could not read blogs:", blogErr.message);
    process.exit(1);
  }

  let stats = new Map<string, Stat>();
  let statsSource = "none";

  if (CSV_PATH) {
    if (!fs.existsSync(CSV_PATH)) {
      console.error(`CSV not found: ${CSV_PATH}`);
      process.exit(1);
    }
    stats = statsFromCsv(CSV_PATH);
    statsSource = `CSV (${path.basename(CSV_PATH)})`;
  } else {
    const { data: statRows } = await supabase
      .from("blog_gsc_stats")
      .select("slug, clicks, impressions, position")
      .limit(10000);
    for (const s of (statRows ?? []) as ({ slug: string } & Stat)[]) {
      stats.set(s.slug, s);
    }
    if (stats.size > 0) statsSource = "blog_gsc_stats table";
  }

  const posts: Post[] = (blogRows ?? []).map(
    (b: { slug: string; title: string; content: string | null; created_at: string }) => {
      const s = stats.get(b.slug);
      return {
        slug: b.slug,
        title: b.title,
        content: b.content,
        created_at: b.created_at,
        clicks: s?.clicks ?? 0,
        impressions: s?.impressions ?? 0,
        position: s?.position ?? null,
        hasStats: !!s,
      };
    }
  );

  if (stats.size === 0) {
    console.log(
      "NOTE: no performance data, so winners are chosen by article length alone.\n" +
        "      Pass --csv <Pages.csv> from a Search Console export, or populate\n" +
        "      blog_gsc_stats via scripts/ingest-gsc-stats.ts, for a real decision.\n"
    );
  } else {
    console.log(`Performance data: ${statsSource} — ${stats.size} slugs\n`);
  }

  const groups = cluster(posts).sort((a, b) => {
    const impA = a.reduce((n, p) => n + p.impressions, 0);
    const impB = b.reduce((n, p) => n + p.impressions, 0);
    return impB - impA;
  });

  const plan: { keep: string; redirect: string[]; note: string }[] = [];

  for (const group of groups) {
    const winner = pickWinner(group);
    const losers = group.filter((p) => p.slug !== winner.slug);
    plan.push({
      keep: winner.slug,
      redirect: losers.map((l) => l.slug),
      note: `${group.length} posts competing; ${group.reduce((n, p) => n + p.impressions, 0)} combined impressions`,
    });
  }

  if (AS_JSON) {
    console.log(JSON.stringify(plan, null, 2));
    return;
  }

  console.log("=".repeat(76));
  console.log(`CONSOLIDATION PLAN — ${groups.length} cluster(s), ${plan.reduce((n, p) => n + p.redirect.length, 0)} post(s) to redirect`);
  console.log("=".repeat(76));

  groups.forEach((group, gi) => {
    const winner = pickWinner(group);
    const totalImp = group.reduce((n, p) => n + p.impressions, 0);
    const totalClicks = group.reduce((n, p) => n + p.clicks, 0);
    console.log(
      `\n── Cluster ${gi + 1} — ${group.length} posts, ${totalImp} impressions, ${totalClicks} clicks ──`
    );
    for (const p of [...group].sort((a, b) => b.impressions - a.impressions)) {
      const role = p.slug === winner.slug ? "KEEP    " : "REDIRECT";
      const perf = p.hasStats
        ? `${String(p.impressions).padStart(4)} imp, ${p.clicks} clk, pos ${p.position?.toFixed(1) ?? "?"}`
        : "no GSC data";
      const words = p.content ? `${Math.round(p.content.length / 6)}w` : "0w";
      console.log(`  ${role}  ${perf.padEnd(28)} ${words.padStart(6)}  ${p.title.slice(0, 62)}`);
      console.log(`            /blog/${p.slug}`);
    }
  });

  console.log("\n" + "=".repeat(76));
  console.log("SUGGESTED next.config REDIRECTS");
  console.log("=".repeat(76));
  for (const entry of plan) {
    for (const from of entry.redirect) {
      console.log(
        `  { source: "/blog/${from}", destination: "/blog/${entry.keep}", permanent: true },`
      );
    }
  }

  console.log("\n" + "=".repeat(76));
  console.log("BEFORE APPLYING");
  console.log("=".repeat(76));
  console.log(
    [
      "1. Merge anything worth keeping from each REDIRECT post into the KEEP post",
      "   first. A 301 passes ranking signal, not content — whatever is only in",
      "   the loser is lost once the redirect is live.",
      "2. Redirects are permanent (301) and outward-facing. Review every row.",
      "3. Remove the redirected slugs from the sitemap so Google stops being",
      "   pointed at URLs that now bounce (app/sitemap.ts reads from Supabase,",
      "   so deleting or flagging the rows handles this).",
      "4. Expect 2-6 weeks before the consolidated page settles at its new",
      "   position.",
    ].join("\n")
  );
}

run();
