/**
 * Bring the Klippa alternatives post up to date with the SER Group
 * acquisition and the Doxis rebrand.
 *
 * Why this post specifically: 369 impressions at position 17.6 — the largest
 * impression count in the competitor cluster and the worst position in it —
 * and it is silent on the single most decision-relevant fact about its own
 * subject.
 *
 * The article was generated 2026-04-14, thirteen months after SER Group
 * acquired Klippa and three months after the group rebranded to Doxis. The
 * bot wrote it from model knowledge rather than current sources, so it
 * recommends alternatives to a product that no longer trades under that name.
 * Anyone searching "klippa alternative" in August 2026 is plausibly searching
 * *because* of that rebrand, which is exactly the question the page fails to
 * answer.
 *
 * Verified facts used here (all from primary or press coverage, Aug 2026):
 *   - SER Group, a German ECM vendor, acquired Dutch company Klippa in
 *     March 2025
 *   - The group rebranded to Doxis in January 2026
 *   - The DocHorizon product name was retired on 30 March 2026
 *   - Klippa DocHorizon is now Doxis AI.dp; SpendControl is now Doxis
 *     SpendControl
 *   - Co-founder Yeelen Knegtering moved to a Chief AI Officer role
 *   - The combined organisation claims 3,000+ customers and 5M+ users
 *
 * Surgical splice rather than a regeneration: the existing structure, the
 * seven alternatives and the comparison table all still work, and a full
 * rewrite would risk losing them while introducing fresh unsourced claims.
 *
 * Usage:
 *   npx tsx scripts/refresh-klippa-post.ts --dry-run
 *   npx tsx scripts/refresh-klippa-post.ts
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
const SLUG = "best-alternatives-to-klippa-7-top-tier-ai-invoice-ocr-solutions-for-2026";

/**
 * Self-contained answer for the top of the page. Written to stand alone if an
 * AI summary lifts it out, which is the point of the format.
 */
const LEAD_ANSWER = `**Klippa no longer exists under that name. SER Group acquired it in March 2025, the group rebranded to Doxis in January 2026, and the DocHorizon product name was retired on 30 March 2026 — what you knew as Klippa DocHorizon is now Doxis AI.dp. If you are looking for an alternative because of that change, the seven options below are compared on the things an acquisition usually disturbs: pricing transparency, whether the tool still fits a small team, and how much setup it demands.**

`;

const UPDATE_BLOCK = `## Update: Klippa is now Doxis (what changed and why it matters)

If you arrived here after noticing the Klippa brand disappear, here is the sequence:

| When | What happened |
|---|---|
| March 2025 | SER Group, a German enterprise content management vendor, acquired Klippa (Netherlands) |
| January 2026 | The combined group rebranded to **Doxis** |
| 30 March 2026 | The **DocHorizon** product name was retired |
| Now | Klippa DocHorizon is **Doxis AI.dp**; Klippa SpendControl is **Doxis SpendControl** |

Klippa co-founder Yeelen Knegtering moved into a Chief AI Officer role, and the combined organisation reports more than 3,000 customers and over 5 million users. The stated strategy is to fold document *processing* into Doxis's wider document *management* platform — archiving, case management, workflow.

**What this means for you depends entirely on your size**, and it is worth being straight about the uncertainty here rather than predicting doom. An acquisition of this shape does tend to move three things, so these are what to actually verify against your own account rather than assume:

- **Pricing structure.** Standalone tools that join a suite are commonly repackaged into platform tiers. Check whether your current rate survives renewal.
- **Roadmap priority.** An enterprise ECM buyer's roadmap is set by enterprise accounts. If you are a small team on a self-serve plan, ask where you now sit in that queue.
- **Support routing.** Support that once came from a focused product team often moves into a larger organisation's structure.

None of that makes Doxis a bad product — a bigger platform is genuinely an advantage if you also need archiving and case management. It is a poor fit mainly if you wanted a narrow tool that does one job and stays cheap. That distinction is what the comparison below is organised around.

`;

async function run() {
  console.log(`Mode: ${DRY_RUN ? "DRY-RUN (no writes)" : "APPLY"}\n`);

  const { data, error } = await supabase
    .from("blogs")
    .select("slug, title, content, meta_description")
    .eq("slug", SLUG)
    .single();

  if (error || !data) {
    console.error(`Could not load ${SLUG}: ${error?.message ?? "not found"}`);
    process.exit(1);
  }

  let content = data.content as string;
  const before = content.length;
  const changes: string[] = [];

  // Guard against double-applying.
  if (content.includes("Update: Klippa is now Doxis")) {
    console.log("Already refreshed — the Doxis update block is present. Nothing to do.");
    return;
  }

  // 1. Lead answer at the very top.
  if (!content.startsWith("**Klippa no longer exists")) {
    content = LEAD_ANSWER + content;
    changes.push("prepended self-contained lead answer");
  }

  // 2. Update block immediately before "Why Look for a Klippa Alternative?",
  //    which is the section a reader hits while asking exactly this.
  const whyHeading = "## Why Look for a Klippa Alternative?";
  if (content.includes(whyHeading)) {
    content = content.replace(whyHeading, UPDATE_BLOCK + whyHeading);
    changes.push("inserted dated Doxis update block before 'Why Look for a Klippa Alternative?'");
  } else {
    console.error("Could not find the 'Why Look for a Klippa Alternative?' heading — aborting rather than splicing blindly.");
    process.exit(1);
  }

  // 3. Replace the unsourced cost figure. The article asserted "$15 per
  //    invoice" with "statistics suggest" and no source — the same invented
  //    -statistic pattern found elsewhere in this corpus. Replaced with
  //    arithmetic the reader can redo and check.
  const unsourced = /Statistics suggest that manual invoice processing costs businesses an average of \$15 per invoice, a figure that balloons when you account for human error, delayed approvals, and lost productivity\./;
  if (unsourced.test(content)) {
    content = content.replace(
      unsourced,
      "The cost is easy to work out for your own team rather than take on faith: time the next ten invoices you key in by hand, multiply the average by your loaded hourly rate, and add whatever a miskeyed figure costs you downstream in a reopened close."
    );
    changes.push("replaced an unsourced $15-per-invoice statistic with checkable arithmetic");
  }

  console.log(`Changes (${changes.length}):`);
  changes.forEach((c) => console.log(`  - ${c}`));
  console.log(`\nContent: ${before} -> ${content.length} chars (+${content.length - before})`);

  if (DRY_RUN) {
    console.log("\n--- first 1400 chars of result ---\n");
    console.log(content.slice(0, 1400));
    console.log("\nDry-run — no writes.");
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
  console.log("\nUpdated. updated_at bumped so the refresh cron treats it as fresh.");
}

run();
