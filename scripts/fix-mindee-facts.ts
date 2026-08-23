/**
 * Correct two factual errors about Mindee in the highest-traffic comparison
 * page (305 impressions, position 10.1).
 *
 * How these were found: the Klippa page turned out to be a year out of date on
 * its own subject, so every competitor page became suspect. A third-party
 * comparison site claimed Mindee had abandoned pre-trained APIs — which would
 * have made two of our pages wrong. Checking mindee.com directly showed that
 * claim is false: Invoice OCR, Receipt OCR, Bank Statement OCR and others are
 * all still offered. The pages were right and no edit was needed there.
 *
 * Verifying against the vendor rather than the aggregator is the whole point.
 * Acting on the secondary source would have replaced a correct statement with
 * an incorrect one.
 *
 * What IS wrong, confirmed against mindee.com/pricing in August 2026:
 *
 *   1. The table credits Mindee with a "250 pages/month (API only)" free tier.
 *      Mindee offers a 14-day trial, no perpetual free allowance. Inventing a
 *      free tier for a competitor is an odd way to be wrong, but it is wrong,
 *      and a reader who signs up expecting 250 free pages a month will find out
 *      the hard way.
 *
 *   2. The table rates Mindee's pricing transparency as "Partially". They
 *      publish Starter at $44/month and Pro at $116/month. Understating a
 *      competitor's strength costs us credibility on every other row of the
 *      same table, so this is corrected in their favour.
 *
 * Usage:
 *   npx tsx scripts/fix-mindee-facts.ts --dry-run
 *   npx tsx scripts/fix-mindee-facts.ts
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
const SLUG = "invoicetodata-vs-mindee-which-invoice-ocr-solution-delivers-better-results-in-20";

/** Exact-string edits so a partial match can never silently corrupt the table. */
const EDITS: { find: string; replace: string; why: string }[] = [
  {
    find: "| Free Tier | 250 pages/month (API only) | Available (web + API) |",
    replace:
      "| Free Tier | 14-day trial only — no perpetual free allowance | Free first conversion, no signup |",
    why: "Mindee has no 250-pages/month free tier; mindee.com/pricing states a 14-day trial",
  },
  {
    find: "| Transparent Public Pricing | Partially | Yes |",
    replace:
      "| Transparent Public Pricing | Yes — Starter $44/mo, Pro $116/mo published | Yes |",
    why: "Mindee publishes its tiers; rating them 'Partially' understated a real strength",
  },
];

/**
 * Note appended so a reader can date the competitor claims, and so the next
 * person to touch this page knows the figures were checked rather than guessed.
 */
const PROVENANCE = `

> Competitor pricing and free-tier details above were verified against mindee.com in August 2026. Vendor pricing changes without notice — check both vendors' current pricing pages before making a decision.
`;

async function run() {
  console.log(`Mode: ${DRY_RUN ? "DRY-RUN (no writes)" : "APPLY"}\n`);

  const { data, error } = await supabase
    .from("blogs")
    .select("content")
    .eq("slug", SLUG)
    .single();
  if (error || !data) {
    console.error(`Could not load ${SLUG}: ${error?.message ?? "not found"}`);
    process.exit(1);
  }

  let content = data.content as string;
  const applied: string[] = [];

  for (const edit of EDITS) {
    if (!content.includes(edit.find)) {
      // Fail loudly rather than silently skipping — if the table changed
      // shape, the correction needs re-deriving, not quietly dropping.
      console.error(`Could not find expected row, aborting:\n  ${edit.find}`);
      process.exit(1);
    }
    content = content.replace(edit.find, edit.replace);
    applied.push(edit.why);
    console.log(`OK  ${edit.why}`);
    console.log(`    - ${edit.find}`);
    console.log(`    + ${edit.replace}\n`);
  }

  if (!content.includes("verified against mindee.com")) {
    // Place the provenance note directly after the comparison table block.
    const tableEnd = content.indexOf("| Transparent Public Pricing");
    const lineEnd = content.indexOf("\n", tableEnd);
    content = content.slice(0, lineEnd + 1) + PROVENANCE + content.slice(lineEnd + 1);
    applied.push("added a dated provenance note under the comparison table");
    console.log("OK  added dated provenance note under the table\n");
  }

  if (DRY_RUN) {
    console.log("Dry-run — no writes.");
    return;
  }

  const { error: updateErr } = await supabase
    .from("blogs")
    .update({ content, updated_at: new Date().toISOString() })
    .eq("slug", SLUG);
  if (updateErr) {
    console.error(`Update failed: ${updateErr.message}`);
    process.exit(1);
  }
  console.log(`Updated ${applied.length} item(s).`);
}

run();
