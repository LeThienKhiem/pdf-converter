/**
 * One-time backfill of internal links in already-published posts.
 *
 * The content crons only shape posts they write, so the 124 posts already in
 * the table kept whatever links they were given. Two things need correcting.
 *
 * 1. HOST. 123 of 124 posts link to https://invoicetodata.com, and vercel.json
 *    permanently redirects that host to www for every non-API path. So
 *    essentially every internal link on the blog — several hundred of them —
 *    is a redirect hop. Mechanical to fix, and the clear win here.
 *
 * 2. THE BANK CONVERTER. /tools/bank-statement-to-excel earns more clicks than
 *    any other page on the site (22 of 68 over 90 days, 2.18% CTR) and was
 *    absent from the link list both content crons inject until 2026-09-06, so
 *    only 3 posts link to it.
 *
 *    Be clear about the size of this: no post contains the phrase "bank
 *    statement converter" at all, and only six contain any phrase that could
 *    become a natural anchor. This adds a handful of links, not a hundred. It
 *    is worth doing and it will not by itself move "bank statement converter
 *    ai" off position 10 — that needs off-site authority. Overstating it would
 *    be worse than skipping it.
 *
 * What this deliberately does NOT do is append a "Related Articles" block to
 * every post, the way app/api/cron/internal-links/route.ts would. That cron
 * picks related posts by counting overlap across 12 coarse topics, on a corpus
 * where "invoice" appears in 71% of titles — so nearly every pair shares
 * several topics and the top three are close to arbitrary. Adding ~370
 * near-random links to spread equity mostly spreads it nowhere.
 *
 * Anchors are only ever made from text already in the post. Nothing is written
 * into a sentence that did not exist, and an insertion point inside an
 * existing link, a code span or fence, or a heading is refused.
 *
 * Usage:
 *   npx tsx scripts/backfill-internal-links.ts              # dry-run
 *   npx tsx scripts/backfill-internal-links.ts --apply
 *   npx tsx scripts/backfill-internal-links.ts --apply --limit 5
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

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const LIMIT = (() => {
  const i = args.indexOf("--limit");
  return i !== -1 ? Number(args[i + 1]) || Infinity : Infinity;
})();

const OLD_HOST = "https://invoicetodata.com";
const NEW_HOST = "https://www.invoicetodata.com";
const BANK_URL = `${NEW_HOST}/tools/bank-statement-to-excel`;

/**
 * Anchor phrases for the bank converter, most specific first.
 *
 * "AI bank statement converter" leads because that is the phrasing the page
 * actually ranks for: "bank statement converter ai" sits at position 10.1 and
 * is the fastest-growing live query on the site, while the plain "bank
 * statement to excel" variants sit at 45-53 and stopped accruing impressions.
 */
const BANK_ANCHORS = [
  "AI bank statement converter",
  "bank statement converter",
  "convert bank statements to Excel",
  "bank statements to Excel",
  "bank statement to Excel",
];

type Post = { id: string; slug: string; title: string; content: string };

/** Character ranges an anchor must not be inserted into. */
function protectedSpans(md: string): [number, number][] {
  const spans: [number, number][] = [];
  const patterns = [
    /```[\s\S]*?```/g, // fenced code
    /`[^`\n]*`/g, // inline code
    /!?\[[^\]]*\]\([^)]*\)/g, // markdown links and images, whole span
    /https?:\/\/[^\s)]+/g, // bare URLs
  ];
  for (const re of patterns) {
    for (const m of md.matchAll(re)) {
      if (m.index !== undefined) spans.push([m.index, m.index + m[0].length]);
    }
  }
  // Headings: a link inside one is not the placement we want.
  let offset = 0;
  for (const line of md.split("\n")) {
    if (/^\s{0,3}#{1,6}\s/.test(line)) spans.push([offset, offset + line.length]);
    offset += line.length + 1;
  }
  return spans;
}

function isProtected(spans: [number, number][], start: number, end: number): boolean {
  return spans.some(([a, b]) => start < b && end > a);
}

/**
 * True when the post already links this path, whatever host it used.
 *
 * Host-agnostic on purpose: pass 1 rewrites hosts, and an exact-URL check
 * would call a post unlinked purely because it used the old host, then add a
 * second link beside the one already there.
 */
function alreadyLinks(md: string, url: string): boolean {
  return md.includes(url.replace(/^https?:\/\/[^/]+/, ""));
}

/**
 * Link the first safe occurrence of an anchor phrase. Returns null when the
 * post has no usable occurrence — the common case, and not an error.
 */
function linkFirstSafeOccurrence(
  md: string,
  anchors: string[],
  url: string
): { content: string; anchor: string; context: string } | null {
  const spans = protectedSpans(md);
  for (const anchor of anchors) {
    const re = new RegExp(anchor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    for (const m of md.matchAll(re)) {
      if (m.index === undefined) continue;
      const start = m.index;
      const end = start + m[0].length;
      if (isProtected(spans, start, end)) continue;
      return {
        content: `${md.slice(0, start)}[${m[0]}](${url})${md.slice(end)}`,
        anchor: m[0],
        context: md.slice(Math.max(0, start - 60), end + 60).replace(/\s+/g, " "),
      };
    }
  }
  return null;
}

async function run() {
  console.log(`Mode: ${APPLY ? "APPLY" : "DRY-RUN (no writes)"}\n`);

  const { data, error } = await supabase
    .from("blogs")
    .select("id, slug, title, content")
    .order("created_at", { ascending: false })
    .limit(10000);
  if (error) {
    console.error(`Could not read blogs: ${error.message}`);
    process.exitCode = 1;
    return;
  }
  const posts = (data ?? []) as Post[];
  console.log(`posts: ${posts.length}\n`);

  let hostFixed = 0;
  let hostLinks = 0;
  let bankAdded = 0;
  const bankExamples: string[] = [];
  const updates: { id: string; slug: string; content: string }[] = [];

  for (const post of posts) {
    let content = post.content;
    let changed = false;

    // Pass 1 — canonical host.
    const hits = content.split(OLD_HOST).length - 1;
    if (hits > 0) {
      content = content.split(OLD_HOST).join(NEW_HOST);
      hostFixed++;
      hostLinks += hits;
      changed = true;
    }

    // Pass 2 — bank converter, only where a natural anchor already exists.
    if (!alreadyLinks(content, BANK_URL)) {
      const linked = linkFirstSafeOccurrence(content, BANK_ANCHORS, BANK_URL);
      if (linked) {
        content = linked.content;
        bankAdded++;
        changed = true;
        if (bankExamples.length < 8) {
          bankExamples.push(
            `  ${post.slug.slice(0, 56)}\n      anchor "${linked.anchor}"\n      ...${linked.context}...`
          );
        }
      }
    }

    if (changed && updates.length < LIMIT) {
      updates.push({ id: post.id, slug: post.slug, content });
    }
  }

  console.log(`Pass 1 — canonical host`);
  console.log(`  posts containing ${OLD_HOST}: ${hostFixed}`);
  console.log(`  individual links rewritten to www: ${hostLinks}`);

  console.log(`\nPass 2 — bank converter link`);
  console.log(`  posts gaining a link: ${bankAdded}`);
  if (bankExamples.length) {
    console.log(`\n  placements:`);
    for (const e of bankExamples) console.log(e);
  }

  console.log(`\nposts to write: ${updates.length}`);
  if (!APPLY) {
    console.log(`\nDry-run — nothing written. Re-run with --apply.`);
    return;
  }

  // A 123-post content mutation deserves an undo. Dump the pre-change rows
  // before the first write, keyed by id, so a bad outcome is a restore rather
  // than a reconstruction.
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = path.join(process.cwd(), `backup-blogs-${stamp}.json`);
  fs.writeFileSync(
    backupPath,
    JSON.stringify(
      posts
        .filter((p) => updates.some((u) => u.id === p.id))
        .map((p) => ({ id: p.id, slug: p.slug, content: p.content })),
      null,
      2
    ),
    "utf-8"
  );
  console.log(`
backup of pre-change content: ${path.basename(backupPath)}`);

  let written = 0;
  for (const u of updates) {
    const { error: upErr } = await supabase
      .from("blogs")
      .update({ content: u.content })
      .eq("id", u.id);
    if (upErr) console.error(`  FAILED ${u.slug}: ${upErr.message}`);
    else written++;
  }
  console.log(`\nwrote ${written} of ${updates.length} post(s).`);
}

run();
