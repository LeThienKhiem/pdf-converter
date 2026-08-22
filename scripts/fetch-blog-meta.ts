/**
 * Read-only: print current title, meta_description, keywords for target slugs.
 *
 * Usage: npx tsx scripts/fetch-blog-meta.ts
 *
 * The slug list mirrors the GSC underperformers audit. GSC truncates URLs at
 * ~80 chars, so we match by prefix (ilike '<prefix>%') to catch full slugs.
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
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    process.env[key] = val;
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase env vars");
  process.exit(1);
}
const supabase = createClient(supabaseUrl, supabaseKey);

// Slug prefixes to fetch (matches GSC-truncated URLs to full DB slug).
const TARGET_PREFIXES = [
  "invoicetodata-vs-mindee",
  "invoicetodata-vs-nanonets",
  "invoicetodata-vs-veryfi",
  "nanonets-vs-invoicetodata",
  "rossum-invoice-ocr",
  "how-to-automate-accounts-payable",
  "how-to-choose-the-best-invoice-ocr",
  "ai-powered-invoice-data-extraction",
  "best-alternatives-to-klippa",
];

async function run() {
  const { data, error } = await supabase
    .from("blogs")
    .select("slug, title, meta_description, keywords")
    .order("slug");

  if (error) {
    console.error("Query failed:", error.message);
    process.exit(1);
  }
  if (!data) {
    console.log("No rows.");
    return;
  }

  type Row = { slug: string; title: string; meta_description: string | null; keywords: string | null };
  const rows = data as Row[];

  for (const prefix of TARGET_PREFIXES) {
    const matches = rows.filter((r) => r.slug.startsWith(prefix));
    console.log("=".repeat(80));
    console.log(`PREFIX: ${prefix}   (${matches.length} match${matches.length === 1 ? "" : "es"})`);
    console.log("=".repeat(80));
    for (const m of matches) {
      console.log(`\n  slug: ${m.slug}`);
      console.log(`  title (${m.title.length} chars):`);
      console.log(`    ${m.title}`);
      const md = m.meta_description ?? "";
      console.log(`  meta_description (${md.length} chars):`);
      console.log(`    ${md}`);
      console.log(`  keywords:`);
      console.log(`    ${m.keywords ?? "(none)"}`);
    }
    if (matches.length === 0) {
      console.log("  (no match)");
    }
  }
}

run();
