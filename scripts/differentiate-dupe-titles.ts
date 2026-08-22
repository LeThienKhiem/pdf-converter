/**
 * Give genuinely-distinct articles distinct titles, instead of redirecting one
 * into the other.
 *
 * Why not a 301: scripts/compare-cluster-content.ts showed that every post
 * slated for redirect carries sections the winner does not. A 301 passes
 * ranking signal, not content, so redirecting would have deleted real
 * material. And the volume does not justify the merge work — of the three
 * clusters found, two hold 13 and 0 impressions over 90 days.
 *
 * The one cluster worth acting on is the pair published under an identical
 * title (129 and 13 impressions, positions 17.6 and 24.1). Two indexed pages
 * with the same title compete for the same query, but their bodies differ in
 * angle: one breaks down pricing models tool by tool, the other leads with a
 * comparison table and argues about value for money. Distinct titles remove
 * the collision while keeping both articles whole.
 *
 * Usage:
 *   npx tsx scripts/differentiate-dupe-titles.ts --dry-run
 *   npx tsx scripts/differentiate-dupe-titles.ts
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

type Update = { slug: string; title: string; meta_description: string; why: string };

const UPDATES: Update[] = [
  {
    // Sections: "The Landscape: Invoice OCR Pricing Models in 2026",
    // "Deep Dive: Analyzing the Cost of Leading Tools". The angle is
    // per-tool cost structure, so the title now says that.
    slug: "invoice-ocr-pricing-comparison-2026-finding-the-best-value-for-your-business",
    title: "Invoice OCR Pricing 2026: Cost Breakdown by Tool",
    meta_description:
      "Compare invoice OCR pricing models for 2026 — per-page, subscription, and enterprise tiers across ABBYY, Nanonets, and Rossum. Start free today.",
    why: "keeps the stronger page (129 imp, pos 17.6); retitled to its actual angle",
  },
  {
    // Sections: "Pricing Comparison Table", "Analyzing Value: What Are You
    // Actually Paying For?". The angle is value-for-money, not price lists.
    slug: "invoice-ocr-pricing-comparison-2026-finding-the-best-value-for-your-business-2026-04-19",
    title: "Invoice OCR Cost vs Value: What You Pay For in 2026",
    meta_description:
      "Cheapest invoice OCR isn't always best value. Learn what each pricing tier actually buys — accuracy, line items, support — before you commit.",
    why: "was published under a title identical to the above; retitled to its distinct angle",
  },
];

// Same gates as the optimize-meta cron, so its weekly run won't undo this.
const POWER_WORD_RE = /(free|save|fast|easy|instant|step|guide|how to|best|top|quick|simple|automate|cheap)/i;
const CTA_RE = /(try|start|learn|discover|get|download|convert|extract|compare)/i;

function preflight(u: Update): string[] {
  const errs: string[] = [];
  if (u.title.length < 20 || u.title.length > 65) {
    errs.push(`title length ${u.title.length} (want 20-65)`);
  }
  if (u.meta_description.length < 80 || u.meta_description.length > 165) {
    errs.push(`meta length ${u.meta_description.length} (want 80-165)`);
  }
  if (!POWER_WORD_RE.test(u.meta_description) && !CTA_RE.test(u.meta_description)) {
    errs.push("meta has neither a power word nor a CTA verb");
  }
  return errs;
}

async function run() {
  console.log(`Mode: ${DRY_RUN ? "DRY-RUN (no writes)" : "APPLY"}\n`);

  let failed = false;
  for (const u of UPDATES) {
    const errs = preflight(u);
    if (errs.length) {
      failed = true;
      console.error(`FAIL ${u.slug}`);
      errs.forEach((e) => console.error(`     ${e}`));
    }
  }
  if (failed) {
    console.error("\nPreflight failed.");
    process.exit(1);
  }

  // Guard: the whole point is to end up with two different titles.
  const titles = new Set(UPDATES.map((u) => u.title.toLowerCase()));
  if (titles.size !== UPDATES.length) {
    console.error("Proposed titles are not all distinct — that defeats the purpose.");
    process.exit(1);
  }
  console.log("Preflight OK (lengths, gates, and titles all distinct)\n");

  let updated = 0;
  for (const [i, u] of UPDATES.entries()) {
    const { data: current, error: readErr } = await supabase
      .from("blogs")
      .select("title, meta_description")
      .eq("slug", u.slug)
      .single();
    if (readErr || !current) {
      console.error(`[${i + 1}] slug not found: ${u.slug}`);
      continue;
    }

    console.log(`[${i + 1}/${UPDATES.length}] ${u.slug}`);
    console.log(`  reason: ${u.why}`);
    console.log(`  TITLE OLD: ${current.title}`);
    console.log(`  TITLE NEW: ${u.title}`);
    console.log(`  META  OLD: ${current.meta_description ?? "(none)"}`);
    console.log(`  META  NEW: ${u.meta_description}`);

    if (!DRY_RUN) {
      const { error } = await supabase
        .from("blogs")
        .update({ title: u.title, meta_description: u.meta_description })
        .eq("slug", u.slug);
      if (error) {
        console.error(`  FAILED: ${error.message}`);
      } else {
        console.log("  updated");
        updated++;
      }
    }
    console.log();
  }

  console.log(DRY_RUN ? "Dry-run — no writes." : `Updated ${updated}/${UPDATES.length}`);
}

run();
