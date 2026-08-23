/**
 * One-command performance check against a frozen baseline.
 *
 * Run this a week or two after the SEO work landed to see what actually moved.
 * The baseline below is a snapshot taken 2026-08-22, the day the changes went
 * out — it is deliberately hardcoded rather than read from the database, so
 * that re-importing GSC data can never quietly overwrite the thing we are
 * measuring against.
 *
 * Usage:
 *   # page-level only, reading current data from blog_gsc_stats
 *   npx tsx scripts/check-seo-performance.ts
 *
 *   # page-level from a fresh export (skips the DB entirely)
 *   npx tsx scripts/check-seo-performance.ts --csv path/to/Pages.csv
 *
 *   # add query-level tracking (Klippa cluster, Claude cluster, brand)
 *   npx tsx scripts/check-seo-performance.ts --queries path/to/Queries.csv
 *
 * A note on how to read the output, because this is where it is easy to fool
 * yourself: a page with 20 impressions that goes from 0 to 1 click has not
 * "improved by infinity" — at that volume a single click is noise. The report
 * marks rows as INSUFFICIENT rather than printing a percentage swing for them.
 * Two conclusions during the original audit had to be retracted for exactly
 * this reason, so the guard is in the tool instead of in someone's memory.
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

const args = process.argv.slice(2);
function flagValue(name: string): string | null {
  const i = args.indexOf(name);
  return i !== -1 ? args[i + 1] ?? null : null;
}
const CSV_PATH = flagValue("--csv");
const QUERIES_PATH = flagValue("--queries");

const BASELINE_DATE = "2026-08-22";

/**
 * How many impressions a row needs before a click-rate change means anything.
 * Below this, expected clicks at a normal CTR round to under one, so zero
 * clicks is the unremarkable outcome rather than evidence of a problem.
 */
const MIN_IMPRESSIONS_FOR_CTR = 100;

/** Position moves smaller than this are ordinary SERP fluctuation. */
const MEANINGFUL_POSITION_DELTA = 3;

type Snapshot = { clicks: number; impressions: number; position: number };

/** Page-level baseline — the 12 posts whose title and meta were rewritten. */
const BASELINE_REWRITTEN: Record<string, Snapshot> = {
  "how-to-automate-accounts-payable-with-ocr-a-step-by-step-guide-for-growth": { clicks: 0, impressions: 1045, position: 84.4 },
  "ai-powered-invoice-data-extraction-how-machine-learning-is-redefining-accuracy-i": { clicks: 1, impressions: 654, position: 60.4 },
  "how-to-choose-the-best-invoice-ocr-software-a-2026-buyers-guide": { clicks: 0, impressions: 614, position: 59.9 },
  "best-alternatives-to-klippa-7-top-tier-ai-invoice-ocr-solutions-for-2026": { clicks: 0, impressions: 369, position: 17.6 },
  "invoicetodata-vs-mindee-which-invoice-ocr-solution-delivers-better-results-in-20": { clicks: 0, impressions: 305, position: 10.1 },
  "invoicetodata-vs-nanonets-choosing-the-right-invoice-ocr-software-for-your-ap-wo": { clicks: 0, impressions: 136, position: 8.7 },
  "invoicetodata-vs-mindee": { clicks: 0, impressions: 74, position: 12.2 },
  "invoicetodata-vs-nanonets": { clicks: 0, impressions: 61, position: 7.7 },
  "invoicetodata-vs-mindee-choosing-the-best-invoice-ocr-software-for-your-workflow": { clicks: 0, impressions: 54, position: 10.7 },
  "invoicetodata-vs-veryfi-which-ai-invoice-ocr-solution-is-right-for-your-business": { clicks: 0, impressions: 48, position: 10.1 },
  "rossum-invoice-ocr-why-enterprise-pricing-breaks-smb-bookkeeper-budgets": { clicks: 0, impressions: 37, position: 11.2 },
  "nanonets-vs-invoicetodata-edge-cases-that-break-production-deployments": { clicks: 0, impressions: 21, position: 7.6 },
};

/** Pages whose content changed on 2026-08-22 — expect rank movement, slowly. */
const BASELINE_CONTENT_CHANGED: Record<string, Snapshot & { what: string }> = {
  "best-alternatives-to-klippa-7-top-tier-ai-invoice-ocr-solutions-for-2026": {
    clicks: 0, impressions: 369, position: 17.6,
    what: "added Doxis acquisition/rebrand facts, lead answer, retitled",
  },
  "invoicetodata-vs-mindee-which-invoice-ocr-solution-delivers-better-results-in-20": {
    clicks: 0, impressions: 305, position: 10.1,
    what: "corrected two false Mindee facts (free tier, pricing transparency)",
  },
  "invoice-ocr-pricing-comparison-2026-finding-the-best-value-for-your-business": {
    clicks: 0, impressions: 129, position: 17.6,
    what: "retitled to break the duplicate-title collision",
  },
  "invoice-ocr-pricing-comparison-2026-finding-the-best-value-for-your-business-2026-04-19": {
    clicks: 0, impressions: 13, position: 24.1,
    what: "retitled to its own angle (cost vs value)",
  },
};

/** Published 2026-08-22 with no history — any impressions at all is the signal. */
const NEW_PAGES = ["klippa-vs-netfira"];

/** Query-level baseline. Only checked when --queries is supplied. */
const BASELINE_QUERIES: Record<string, Snapshot & { group: string; note?: string }> = {
  "klippa alternative": { clicks: 0, impressions: 60, position: 11.32, group: "Klippa cluster", note: "closest thing to page 1 on the whole site" },
  "klippa competitors": { clicks: 0, impressions: 48, position: 29.98, group: "Klippa cluster" },
  "klippa vs netfira": { clicks: 0, impressions: 43, position: 28.7, group: "Klippa cluster", note: "new dedicated page published 2026-08-22" },
  "nanonets competitors": { clicks: 0, impressions: 10, position: 37.8, group: "Competitor cluster" },
  "abbyy flexicapture alternatives": { clicks: 0, impressions: 8, position: 44.38, group: "Competitor cluster" },
  "claude pdf to excel": { clicks: 2, impressions: 15, position: 5.33, group: "Claude cluster", note: "watch impressions, not position — position is already good" },
  "claude convert pdf to excel": { clicks: 0, impressions: 25, position: 7.6, group: "Claude cluster" },
  "can claude convert pdf to excel": { clicks: 0, impressions: 23, position: 9.74, group: "Claude cluster" },
  "claude ai pdf to excel": { clicks: 1, impressions: 7, position: 4, group: "Claude cluster" },
  "invoice to data": { clicks: 1, impressions: 65, position: 48.51, group: "Brand", note: "our own name — alternateName schema added 2026-08-22" },
  "invoice data extraction": { clicks: 0, impressions: 411, position: 80.8, group: "Head term", note: "needs backlinks, not on-page work" },
  "ocr accounts payable": { clicks: 0, impressions: 363, position: 82.32, group: "Head term" },
};

/** Blog-wide baseline. The band distribution is the headline metric. */
const BASELINE_TOTALS = { posts: 84, clicks: 9, impressions: 4999 };
const BASELINE_BANDS = [
  { label: "1-10   (page 1)", lo: 0, hi: 10, posts: 30, impressions: 367, clicks: 0 },
  { label: "11-20  (page 2)", lo: 10, hi: 20, posts: 22, impressions: 1464, clicks: 2 },
  { label: "21-50  (page 3-5)", lo: 20, hi: 50, posts: 21, impressions: 734, clicks: 6 },
  { label: "51+    (page 6+)", lo: 50, hi: 1e9, posts: 11, impressions: 2434, clicks: 1 },
];

// ── CSV parsing ────────────────────────────────────────────────────────

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

/** Parse a GSC export keyed by either blog slug (Pages) or query text (Queries). */
function parseGscCsv(file: string, mode: "pages" | "queries"): Map<string, Snapshot> {
  const out = new Map<string, Snapshot>();
  const lines = fs.readFileSync(file, "utf-8").split(/\r?\n/).filter((l) => l.trim());
  const header = splitCsvLine(lines[0]).map((h) => h.toLowerCase());
  const iClicks = header.findIndex((h) => h.includes("click"));
  const iImp = header.findIndex((h) => h.includes("impression"));
  const iPos = header.findIndex((h) => h.includes("position"));

  for (const line of lines.slice(1)) {
    const cells = splitCsvLine(line);
    const key = mode === "pages"
      ? cells[0]?.match(/\/blog\/([^/?#]+)/)?.[1]
      : cells[0]?.toLowerCase();
    if (!key) continue;

    const clicks = Number(cells[iClicks]) || 0;
    const impressions = Number(cells[iImp]) || 0;
    const position = iPos >= 0 ? Number(cells[iPos]) || 0 : 0;

    // GSC reports www and non-www as separate rows for the same page.
    const prev = out.get(key);
    if (prev) {
      const total = prev.impressions + impressions;
      if (total > 0) {
        prev.position = (prev.position * prev.impressions + position * impressions) / total;
      }
      prev.clicks += clicks;
      prev.impressions += impressions;
    } else {
      out.set(key, { clicks, impressions, position });
    }
  }
  return out;
}

// ── formatting helpers ─────────────────────────────────────────────────

function ctr(s: Snapshot): number {
  return s.impressions > 0 ? (s.clicks / s.impressions) * 100 : 0;
}

function deltaStr(before: number, after: number, digits = 1): string {
  const d = after - before;
  const sign = d > 0 ? "+" : "";
  return `${sign}${d.toFixed(digits)}`;
}

/** Position improving means the number going DOWN, which reads backwards. */
function positionVerdict(before: number, after: number): string {
  const d = after - before;
  if (Math.abs(d) < MEANINGFUL_POSITION_DELTA) return "flat";
  return d < 0 ? `BETTER by ${Math.abs(d).toFixed(1)}` : `worse by ${d.toFixed(1)}`;
}

function header(title: string) {
  console.log("\n" + "=".repeat(78));
  console.log(title);
  console.log("=".repeat(78));
}

// ── main ───────────────────────────────────────────────────────────────

async function loadCurrentPages(): Promise<Map<string, Snapshot> | null> {
  if (CSV_PATH) {
    if (!fs.existsSync(CSV_PATH)) {
      console.error(`CSV not found: ${CSV_PATH}`);
      process.exit(1);
    }
    console.log(`Current page data: ${path.basename(CSV_PATH)}`);
    return parseGscCsv(CSV_PATH, "pages");
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""
  );
  const { data, error } = await supabase
    .from("blog_gsc_stats")
    .select("slug, clicks, impressions, position, imported_at")
    .limit(10000);

  if (error) {
    console.error(`Could not read blog_gsc_stats: ${error.message}`);
    console.error("Pass --csv <Pages.csv> instead, or run scripts/ingest-gsc-stats.ts first.");
    return null;
  }
  const rows = (data ?? []) as ({ slug: string; imported_at?: string } & Snapshot)[];
  if (rows.length === 0) {
    console.error("blog_gsc_stats is empty — import a fresh export first.");
    return null;
  }
  const importedAt = rows[0].imported_at?.slice(0, 10) ?? "unknown";
  console.log(`Current page data: blog_gsc_stats (imported ${importedAt})`);
  if (importedAt === BASELINE_DATE) {
    console.log(
      `\n  NOTE: the table still holds the ${BASELINE_DATE} import — the same data as the\n` +
      `  baseline. Every delta below will read as zero until you import a fresh export.\n` +
      `  Run: npx tsx scripts/ingest-gsc-stats.ts "path/to/new-Pages.csv"`
    );
  }
  const map = new Map<string, Snapshot>();
  for (const r of rows) {
    map.set(r.slug, { clicks: r.clicks, impressions: r.impressions, position: r.position });
  }
  return map;
}

async function run() {
  console.log(`SEO performance check — baseline frozen at ${BASELINE_DATE}`);
  const current = await loadCurrentPages();
  if (!current) process.exit(1);

  // ── A. Title/meta rewrites — CTR is the thing that should move first ──
  header("A. TITLE/META REWRITES — expect CTR movement within 1-2 weeks");
  console.log("Only rows at or above " + MIN_IMPRESSIONS_FOR_CTR + " impressions can support a CTR conclusion.\n");
  console.log(`${"imp".padStart(6)} ${"CTR before".padStart(11)} ${"CTR now".padStart(9)}  ${"verdict".padEnd(14)} page`);

  const readable: string[] = [];
  const tooSmall: string[] = [];
  for (const [slug, before] of Object.entries(BASELINE_REWRITTEN)) {
    const now = current.get(slug);
    if (!now) {
      tooSmall.push(`${slug.slice(0, 52)} — absent from current export`);
      continue;
    }
    if (now.impressions < MIN_IMPRESSIONS_FOR_CTR) {
      tooSmall.push(`${slug.slice(0, 52)} — ${now.impressions} imp`);
      continue;
    }
    const cBefore = ctr(before);
    const cNow = ctr(now);
    const verdict = cNow > cBefore + 0.3 ? "IMPROVED" : cNow < cBefore - 0.3 ? "declined" : "flat";
    readable.push(
      `${String(now.impressions).padStart(6)} ${cBefore.toFixed(2).padStart(10)}% ${cNow.toFixed(2).padStart(8)}%  ${verdict.padEnd(14)} ${slug.slice(0, 46)}`
    );
  }
  readable.forEach((l) => console.log(l));
  if (tooSmall.length) {
    console.log(`\nINSUFFICIENT DATA (${tooSmall.length}) — do not read a trend from these:`);
    tooSmall.forEach((l) => console.log(`  ${l}`));
  }

  // ── B. Content changes — rank moves, and slowly ───────────────────────
  header("B. CONTENT CHANGES — expect rank movement over 3-8 weeks, not days");
  for (const [slug, before] of Object.entries(BASELINE_CONTENT_CHANGED)) {
    const now = current.get(slug);
    console.log(`\n  ${slug.slice(0, 66)}`);
    console.log(`    changed: ${before.what}`);
    if (!now) {
      console.log(`    absent from current export`);
      continue;
    }
    console.log(
      `    pos ${before.position.toFixed(1)} -> ${now.position.toFixed(1)}  (${positionVerdict(before.position, now.position)})` +
      `   imp ${before.impressions} -> ${now.impressions} (${deltaStr(before.impressions, now.impressions, 0)})`
    );
  }

  // ── C. Brand-new pages ────────────────────────────────────────────────
  header("C. NEW PAGES — any impressions at all means it got indexed");
  for (const slug of NEW_PAGES) {
    const now = current.get(slug);
    if (!now || now.impressions === 0) {
      console.log(`  NOT YET INDEXED   /blog/${slug}`);
      console.log(`                    (normal for the first week or two)`);
    } else {
      console.log(
        `  INDEXED           /blog/${slug}` +
        `\n                    ${now.impressions} imp, ${now.clicks} clicks, pos ${now.position.toFixed(1)}`
      );
    }
  }

  // ── D. Band distribution — the headline metric ─────────────────────────
  header("D. BAND DISTRIBUTION — the metric that matters most");
  console.log("Internal linking and consolidation show up here before they show up in clicks.");
  console.log("The goal is impressions moving OUT of the 51+ band.\n");
  console.log(`${"band".padEnd(20)} ${"imp before".padStart(11)} ${"imp now".padStart(9)} ${"share before".padStart(13)} ${"share now".padStart(10)}`);

  const rows = [...current.values()];
  const totalNow = rows.reduce((n, r) => n + r.impressions, 0);
  let band51ShareBefore = 0;
  let band51ShareNow = 0;

  for (const band of BASELINE_BANDS) {
    const inBand = rows.filter((r) => r.position > band.lo && r.position <= band.hi);
    const impNow = inBand.reduce((n, r) => n + r.impressions, 0);
    const shareBefore = (band.impressions / BASELINE_TOTALS.impressions) * 100;
    const shareNow = totalNow > 0 ? (impNow / totalNow) * 100 : 0;
    if (band.lo === 50) { band51ShareBefore = shareBefore; band51ShareNow = shareNow; }
    console.log(
      `${band.label.padEnd(20)} ${String(band.impressions).padStart(11)} ${String(impNow).padStart(9)} ` +
      `${shareBefore.toFixed(1).padStart(12)}% ${shareNow.toFixed(1).padStart(9)}%`
    );
  }

  const clicksNow = rows.reduce((n, r) => n + r.clicks, 0);
  console.log(
    `\n${"TOTAL".padEnd(20)} ${String(BASELINE_TOTALS.impressions).padStart(11)} ${String(totalNow).padStart(9)}` +
    `   clicks ${BASELINE_TOTALS.clicks} -> ${clicksNow} (${deltaStr(BASELINE_TOTALS.clicks, clicksNow, 0)})`
  );

  const band51Delta = band51ShareNow - band51ShareBefore;
  console.log(
    `\n  51+ band: ${band51ShareBefore.toFixed(1)}% -> ${band51ShareNow.toFixed(1)}% (${deltaStr(band51ShareBefore, band51ShareNow)} pts)` +
    `\n  ${band51Delta < -3 ? "MOVING THE RIGHT WAY — impressions are climbing out of the invisible band." : band51Delta > 3 ? "WRONG DIRECTION — more impressions are falling out of reach." : "Flat. Expected this early; internal-link effects take 3-8 weeks."}`
  );

  // ── E. Query level (optional) ─────────────────────────────────────────
  if (!QUERIES_PATH) {
    header("E. QUERY-LEVEL TRACKING — skipped");
    console.log("Pass --queries path/to/Queries.csv to compare the Klippa, Claude, brand,");
    console.log("and head-term baselines. GSC exports queries separately from pages.");
  } else if (!fs.existsSync(QUERIES_PATH)) {
    console.error(`\nQueries CSV not found: ${QUERIES_PATH}`);
  } else {
    header("E. QUERY-LEVEL TRACKING");
    const q = parseGscCsv(QUERIES_PATH, "queries");
    const byGroup = new Map<string, string[]>();

    for (const [query, before] of Object.entries(BASELINE_QUERIES)) {
      const now = q.get(query);
      const lines = byGroup.get(before.group) ?? [];
      if (!now) {
        lines.push(`  ${query.padEnd(34)} absent from this export (was ${before.impressions} imp)`);
      } else {
        const impDelta = deltaStr(before.impressions, now.impressions, 0);
        lines.push(
          `  ${query.padEnd(34)} pos ${before.position.toFixed(1)} -> ${now.position.toFixed(1)} ` +
          `(${positionVerdict(before.position, now.position)})   imp ${before.impressions} -> ${now.impressions} (${impDelta})`
        );
      }
      if (before.note) lines.push(`  ${"".padEnd(34)} ^ ${before.note}`);
      byGroup.set(before.group, lines);
    }

    for (const [group, lines] of byGroup) {
      console.log(`\n${group}`);
      lines.forEach((l) => console.log(l));
    }

    console.log(
      `\nReminder: any query under ~50 impressions cannot support a conclusion about` +
      `\nposition or CTR. GSC also anonymises low-volume queries, so an "absent" row` +
      `\nusually means it fell below the reporting threshold, not that it lost ranking.`
    );
  }

  // ── Summary ───────────────────────────────────────────────────────────
  header("WHAT TO DO NEXT");
  console.log(
    [
      "If section A shows CTR improving on the high-impression pages, the title work",
      "  paid off — apply the same framework to the next tier of pages.",
      "",
      "If section B is flat, that is expected before ~3 weeks. Check it again rather",
      "  than concluding the content changes failed.",
      "",
      "If section C still says NOT YET INDEXED after two weeks, request indexing for",
      "  /blog/klippa-vs-netfira in Search Console directly.",
      "",
      "If section D's 51+ band has not budged by week 4, on-page work has hit its",
      "  ceiling and the constraint is domain authority — the backlink cron now fires",
      "  on Mondays, and that is the lever that matters at that point.",
    ].join("\n")
  );
}

run();
