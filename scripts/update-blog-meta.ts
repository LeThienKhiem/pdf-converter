/**
 * Bulk-update blog title + meta_description for a hand-picked list of
 * underperforming slugs (identified via GSC audit — position 7–11 or high
 * impressions with 0 clicks).
 *
 * Every rewrite is designed to satisfy the optimize-meta cron's filter so the
 * weekly Tuesday run won't overwrite them:
 *   - Meta length 120–155 chars (safely inside the 80–165 gate)
 *   - Title length 45–60 chars (inside 20–65 gate)
 *   - Contains ≥1 power word (free/best/how to/guide/…)
 *   - Contains ≥1 CTA verb (try/start/learn/discover/compare/…)
 *
 * Usage:
 *   npx tsx scripts/update-blog-meta.ts --dry-run   # print old→new, no DB write
 *   npx tsx scripts/update-blog-meta.ts             # apply
 */

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    process.env[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase env vars.");
  process.exit(1);
}
const supabase = createClient(supabaseUrl, supabaseKey);

const DRY_RUN = process.argv.includes("--dry-run");

type Update = { slug: string; title: string; meta_description: string };

const UPDATES: Update[] = [
  {
    slug: "invoicetodata-vs-mindee-which-invoice-ocr-solution-delivers-better-results-in-20",
    title: "InvoiceToData vs Mindee: Best Invoice OCR in 2026?",
    meta_description:
      "InvoiceToData vs Mindee for invoice OCR in 2026: compare accuracy, pricing, and Excel export. Discover which AI tool your AP team should try free.",
  },
  {
    slug: "invoicetodata-vs-mindee",
    title: "Mindee vs InvoiceToData: Free AP Automation Compared",
    meta_description:
      "Compare Mindee vs InvoiceToData for free AP automation. See features, pricing, and Excel export side-by-side to find the best invoice OCR for you.",
  },
  {
    slug: "invoicetodata-vs-mindee-choosing-the-best-invoice-ocr-software-for-your-workflow",
    title: "Mindee Alternative? InvoiceToData vs Mindee 2026",
    meta_description:
      "Ready for a Mindee alternative? Compare invoice OCR pricing, accuracy, and speed. Discover why teams switch — try InvoiceToData free today.",
  },
  {
    slug: "invoicetodata-vs-nanonets",
    title: "InvoiceToData vs Nanonets: 2026 Invoice OCR Compared",
    meta_description:
      "Compare InvoiceToData vs Nanonets for 2026: pricing, no-template AI, and Excel export. Discover the best invoice OCR — try free instantly.",
  },
  {
    slug: "invoicetodata-vs-nanonets-choosing-the-right-invoice-ocr-software-for-your-ap-wo",
    title: "Nanonets Alternative: InvoiceToData vs Nanonets 2026",
    meta_description:
      "Nanonets alternative for AP automation? Compare pricing, accuracy, and Excel export. Discover the faster invoice OCR — try free, no card needed.",
  },
  {
    slug: "invoicetodata-vs-veryfi-which-ai-invoice-ocr-solution-is-right-for-your-business",
    title: "InvoiceToData vs Veryfi: Best AI Invoice OCR in 2026",
    meta_description:
      "Compare InvoiceToData vs Veryfi for AI invoice OCR: accuracy, mobile capture, and Excel export. Discover which tool your team should try free.",
  },
  {
    slug: "nanonets-vs-invoicetodata-edge-cases-that-break-production-deployments",
    title: "Nanonets vs InvoiceToData: 7 Edge Cases That Break Ops",
    meta_description:
      "Nanonets vs InvoiceToData in production: 7 real edge cases that break ops leads. Learn which invoice OCR survives — try free, no card needed.",
  },
  {
    slug: "rossum-invoice-ocr-why-enterprise-pricing-breaks-smb-bookkeeper-budgets",
    title: "Rossum Invoice OCR Pricing: Alternative for SMBs 2026",
    meta_description:
      "Rossum invoice OCR pricing shocks solo bookkeepers. Compare real costs at 300–1000 invoices/month and discover a free SMB alternative today.",
  },
  {
    slug: "how-to-automate-accounts-payable-with-ocr-a-step-by-step-guide-for-growth",
    title: "How to Automate Accounts Payable with OCR: 2026 Guide",
    meta_description:
      "Automate accounts payable with OCR in 6 steps. Learn how to eliminate manual data entry, cut invoice processing time 80%, and try our free tool.",
  },
  {
    slug: "how-to-choose-the-best-invoice-ocr-software-a-2026-buyers-guide",
    title: "Best Invoice OCR Software 2026: Buyer's Guide (Free Tools)",
    meta_description:
      "Choose the best invoice OCR software in 2026. Compare pricing, features, and free tools side-by-side. Learn how to automate AP fast — start free today.",
  },
  {
    slug: "ai-powered-invoice-data-extraction-how-machine-learning-is-redefining-accuracy-i",
    title: "AI Invoice Data Extraction 2026: Best ML Tools Compared",
    meta_description:
      "AI-powered invoice data extraction in 2026: how machine learning cuts errors and speeds AP. Learn the tech, compare tools, and start free today.",
  },
  {
    slug: "best-alternatives-to-klippa-7-top-tier-ai-invoice-ocr-solutions-for-2026",
    title: "Best Klippa Alternatives 2026: 7 Top Invoice OCR Tools",
    meta_description:
      "Best Klippa alternatives for 2026: compare 7 top invoice OCR tools by price, accuracy, and Excel export. Discover your best fit — start free today.",
  },
];

// Guard: verify each update passes the optimize-meta cron filter.
// Filter (route.ts:45-58) rejects: desc <80, desc >165, or (no power word AND no CTA).
const POWER_WORD_RE = /(free|save|fast|easy|instant|step|guide|how to|best|top|quick|simple|automate)/i;
const CTA_RE = /(try|start|learn|discover|get|download|convert|extract)/i;

function preflight(u: Update): string[] {
  const errs: string[] = [];
  if (u.title.length < 20 || u.title.length > 65) {
    errs.push(`title length ${u.title.length} (want 20-65)`);
  }
  if (u.meta_description.length < 80 || u.meta_description.length > 165) {
    errs.push(`meta length ${u.meta_description.length} (want 80-165)`);
  }
  const hasPower = POWER_WORD_RE.test(u.meta_description);
  const hasCTA = CTA_RE.test(u.meta_description);
  if (!hasPower && !hasCTA) {
    errs.push("meta lacks BOTH power word and CTA verb (optimize-meta will overwrite)");
  }
  return errs;
}

async function run() {
  console.log(`Mode: ${DRY_RUN ? "DRY-RUN (no writes)" : "APPLY"}`);
  console.log(`Rows: ${UPDATES.length}\n`);

  // Preflight
  let hasErrors = false;
  for (const u of UPDATES) {
    const errs = preflight(u);
    if (errs.length > 0) {
      hasErrors = true;
      console.error(`✗ ${u.slug}`);
      for (const e of errs) console.error(`    ${e}`);
    }
  }
  if (hasErrors) {
    console.error("\nPreflight failed. Fix the entries above before continuing.");
    process.exit(1);
  }
  console.log("Preflight ✓ (all rows pass length + power-word/CTA filter)\n");

  // Fetch current values (to prove slugs exist and log diff)
  const slugs = UPDATES.map((u) => u.slug);
  const { data: current, error: fetchErr } = await supabase
    .from("blogs")
    .select("slug, title, meta_description")
    .in("slug", slugs);
  if (fetchErr) {
    console.error("Fetch failed:", fetchErr.message);
    process.exit(1);
  }
  type Row = { slug: string; title: string; meta_description: string | null };
  const currentBySlug = new Map<string, Row>();
  for (const r of (current ?? []) as Row[]) currentBySlug.set(r.slug, r);

  const missing = UPDATES.filter((u) => !currentBySlug.has(u.slug));
  if (missing.length > 0) {
    console.error(`✗ ${missing.length} slug(s) not found in DB:`);
    for (const m of missing) console.error(`    ${m.slug}`);
    process.exit(1);
  }
  console.log(`Slug lookup ✓ (${UPDATES.length}/${UPDATES.length} slugs exist)\n`);

  // Apply (or dry-run)
  let updated = 0;
  for (let i = 0; i < UPDATES.length; i++) {
    const u = UPDATES[i];
    const cur = currentBySlug.get(u.slug)!;
    console.log(`[${i + 1}/${UPDATES.length}] ${u.slug}`);
    console.log(`  TITLE OLD (${cur.title.length}): ${cur.title}`);
    console.log(`  TITLE NEW (${u.title.length}): ${u.title}`);
    console.log(`  META  OLD (${(cur.meta_description ?? "").length}): ${cur.meta_description ?? "(none)"}`);
    console.log(`  META  NEW (${u.meta_description.length}): ${u.meta_description}`);

    if (!DRY_RUN) {
      const { error } = await supabase
        .from("blogs")
        .update({ title: u.title, meta_description: u.meta_description })
        .eq("slug", u.slug);
      if (error) {
        console.error(`  ✗ update failed: ${error.message}`);
      } else {
        console.log("  ✓ updated");
        updated++;
      }
    }
    console.log();
  }

  console.log(`Done. ${DRY_RUN ? "Dry-run — no writes." : `Updated: ${updated}/${UPDATES.length}`}`);
}

run();
