/**
 * Read-only: for each consolidation cluster, show which H2 sections exist
 * ONLY in the posts slated for redirect.
 *
 * A 301 passes ranking signal, not content. Anything unique to a redirected
 * post is simply gone once the redirect is live, so this answers the question
 * that has to be settled before touching any URL: is there something here
 * worth merging into the winner first, or is the loser genuinely redundant?
 *
 * Usage: npx tsx scripts/compare-cluster-content.ts
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

/** First slug in each group is the winner, per scripts/plan-consolidation.ts. */
const CLUSTERS: string[][] = [
  [
    "invoice-ocr-pricing-comparison-2026-finding-the-best-value-for-your-business",
    "invoice-ocr-pricing-comparison-2026-finding-the-best-value-for-your-business-2026-04-19",
  ],
  [
    "how-to-switch-to-invoice-automation-in-2026-a-step-by-step-migration-guide-for-b",
    "the-practical-guide-to-migration-how-to-switch-to-invoice-automation-in-2026",
    "the-migration-guide-how-to-switch-to-invoice-automation-in-2026",
  ],
  [
    "7-proven-ways-to-reduce-manual-data-entry-in-accounting-for-2026",
    "7-best-ways-to-reduce-manual-data-entry-in-accounting-for-faster-workflows",
  ],
];

function headings(markdown: string): string[] {
  return (markdown.match(/^##\s+(.+)$/gm) ?? []).map((h) =>
    h.replace(/^##\s+/, "").trim()
  );
}

/** Loose match so "## FAQ" and "## Frequently Asked Questions" don't count as unique. */
function normalizeHeading(h: string): string {
  return h
    .toLowerCase()
    .replace(/frequently asked questions/g, "faq")
    .replace(/[^a-z0-9]/g, "");
}

async function run() {
  for (const [ci, slugs] of CLUSTERS.entries()) {
    console.log("\n" + "=".repeat(76));
    console.log(`CLUSTER ${ci + 1}  (first slug = KEEP)`);
    console.log("=".repeat(76));

    const loaded: { slug: string; title: string; len: number; hs: string[] }[] = [];
    for (const slug of slugs) {
      const { data } = await supabase
        .from("blogs")
        .select("slug, title, content")
        .eq("slug", slug)
        .single();
      if (!data) {
        console.log(`  MISSING FROM DB: ${slug}`);
        continue;
      }
      const hs = headings(data.content ?? "");
      loaded.push({ slug, title: data.title, len: (data.content ?? "").length, hs });
      console.log(
        `\n  ${slug === slugs[0] ? "KEEP    " : "REDIRECT"} ${String(data.content?.length ?? 0).padStart(6)} chars, ${hs.length} H2`
      );
      console.log(`           ${data.title}`);
    }
    if (loaded.length < 2) continue;

    const keepHeadings = new Set(loaded[0].hs.map(normalizeHeading));
    let uniqueTotal = 0;
    console.log(`\n  Sections present ONLY in posts slated for redirect:`);
    for (const post of loaded.slice(1)) {
      const unique = post.hs.filter((h) => !keepHeadings.has(normalizeHeading(h)));
      uniqueTotal += unique.length;
      console.log(`    ${post.slug.slice(0, 60)}`);
      if (unique.length === 0) {
        console.log(`      (none — nothing would be lost)`);
      }
      for (const u of unique) console.log(`      - ${u}`);
    }
    console.log(
      `\n  => ${uniqueTotal === 0 ? "SAFE to redirect as-is" : `${uniqueTotal} section(s) to merge into the winner first`}`
    );
  }
}

run();
