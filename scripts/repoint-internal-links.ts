/**
 * Move internal links from a page nobody reaches to the page that earns.
 *
 * Measured over the 90 days to 2026-10-15:
 *
 *   /tools/bank-statement-to-excel   3,723 imp   134 clicks   47% of the site
 *   /tools/pdf-to-gsheet                 0 imp     0 clicks
 *
 * And the link graph pointed the wrong way: 103 of 132 posts linked to
 * pdf-to-gsheet, 11 linked to the bank converter. Six months of internal
 * authority flowing into a page that has never recorded a single impression.
 *
 * INTERNAL_LINKS in the content crons was corrected on 2026-09-06, but only
 * about eight posts have been written since, so the other 124 still carry the
 * old target.
 *
 * What this does: rewrites the href on existing pdf-to-gsheet links to the
 * bank converter, and rewrites the visible anchor text with it — a link
 * reading "PDF to Google Sheets" pointing at a bank statement converter would
 * be worse than leaving it alone, for a reader and for Google.
 *
 * What it deliberately does not do:
 *   - touch a post that already links the bank converter (no doubling up)
 *   - invent new links in sentences that did not have one
 *   - rewrite anything outside a markdown link
 *
 * Usage:
 *   npx tsx scripts/repoint-internal-links.ts              # dry-run
 *   npx tsx scripts/repoint-internal-links.ts --apply
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
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
);

const APPLY = process.argv.includes("--apply");
const SITE = "https://www.invoicetodata.com";
const FROM_PATH = "/tools/pdf-to-gsheet";
const TO_URL = `${SITE}/tools/bank-statement-to-excel`;

/**
 * Anchor text for the rewritten links.
 *
 * "AI bank statement converter" leads because that is the phrasing the target
 * page actually ranks for — "bank statement converter ai" sits at position 8.1
 * with 411 impressions, the only large query on the site that converts.
 *
 * Varied rather than identical across 100 posts: a site where every inbound
 * link carries the same anchor reads as built rather than written, and the
 * variants are all natural descriptions of the same page.
 */
const ANCHORS = [
  "AI bank statement converter",
  "bank statement to Excel converter",
  "convert bank statements to Excel",
  "bank statement converter",
];

type Post = { id: string; slug: string; content: string };

/** Markdown links whose href points at the old target, with any host or none. */
const LINK_RE = /\[([^\]]*)\]\((https?:\/\/[^)]*)?\/tools\/pdf-to-gsheet\/?\)/g;

function repoint(md: string, pickAnchor: () => string): { content: string; changed: number } {
  let changed = 0;
  const content = md.replace(LINK_RE, () => {
    changed++;
    return `[${pickAnchor()}](${TO_URL})`;
  });
  return { content, changed };
}

async function run() {
  console.log(`Mode: ${APPLY ? "APPLY" : "DRY-RUN (no writes)"}\n`);

  const { data, error } = await supabase.from("blogs").select("id, slug, content").limit(10000);
  if (error) {
    console.error(`Could not read blogs: ${error.message}`);
    process.exitCode = 1;
    return;
  }
  const posts = (data ?? []) as Post[];

  let withOld = 0;
  let alreadyLinked = 0;
  let totalLinks = 0;
  const updates: { id: string; slug: string; content: string; n: number }[] = [];
  const examples: string[] = [];
  let anchorIdx = 0;

  for (const post of posts) {
    if (!LINK_RE.test(post.content)) {
      LINK_RE.lastIndex = 0;
      continue;
    }
    LINK_RE.lastIndex = 0;
    withOld++;

    // A post already pointing at the bank converter does not need a second
    // link to it; leave its gsheet link alone rather than duplicating.
    if (post.content.includes("/tools/bank-statement-to-excel")) {
      alreadyLinked++;
      continue;
    }

    const { content, changed } = repoint(post.content, () => ANCHORS[anchorIdx++ % ANCHORS.length]);
    if (changed === 0) continue;
    totalLinks += changed;
    updates.push({ id: post.id, slug: post.slug, content, n: changed });

    if (examples.length < 4) {
      const m = content.match(/\[[^\]]*\]\([^)]*bank-statement-to-excel\)/);
      examples.push(`  ${post.slug.slice(0, 52)}\n      ${m?.[0] ?? ""}`);
    }
  }

  console.log(`posts: ${posts.length}`);
  console.log(`  linking ${FROM_PATH}:            ${withOld}`);
  console.log(`  already link the bank converter: ${alreadyLinked} (left alone)`);
  console.log(`  to repoint:                      ${updates.length} posts, ${totalLinks} links`);
  if (examples.length) {
    console.log(`\nnew links:`);
    for (const e of examples) console.log(e);
  }

  if (!APPLY) {
    console.log(`\nDry-run — nothing written.`);
    return;
  }
  if (updates.length === 0) return;

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backup = path.join(process.cwd(), `backup-repoint-${stamp}.json`);
  fs.writeFileSync(
    backup,
    JSON.stringify(
      posts.filter((p) => updates.some((u) => u.id === p.id)).map((p) => ({ id: p.id, slug: p.slug, content: p.content })),
      null,
      2
    ),
    "utf-8"
  );
  console.log(`\nbackup: ${path.basename(backup)}`);

  let written = 0;
  for (const u of updates) {
    const { error: e } = await supabase.from("blogs").update({ content: u.content }).eq("id", u.id);
    if (e) console.error(`  FAILED ${u.slug}: ${e.message}`);
    else written++;
  }
  console.log(`wrote ${written} of ${updates.length} post(s).`);
}

run();
