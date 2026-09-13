/**
 * Publish the bank statement converter limits reference.
 *
 * Targets the bank+AI query cluster — "bank statement converter ai" and its
 * variants — with the concrete numbers those searchers are actually trying to
 * find: file size cap, page count, export formats, price per page.
 *
 * NO COMPETITOR NAMES OR COLUMNS, deliberately. The first version of this post
 * ran a three-way table against bankstatementconverters.ai and BankScanPro.
 * Every visually prominent row went against us — 50 MB against our 5 MB free,
 * password support against none, three export formats against two — and the
 * closing section sent readers to a competitor twice by name. Accurate, and an
 * advertisement for someone else on our own domain. A spec page for our own
 * tool gets our numbers indexed just as well without handing anyone else the
 * traffic.
 *
 * Our own limitations stay in, with workarounds. Stating a cap on your own
 * page is what makes the rest of the numbers credible; naming the competitor
 * who beats it is what turns the page into their billboard. Those are
 * different things.
 *
 * Figures read from the code on 2026-09-13:
 *   FREE_MAX_BYTES / PAID_MAX_BYTES / FREE_MAX_PAGES   app/api/extract/route.ts
 *   ALLOWED_TYPES                                      app/api/extract/route.ts
 *   GUEST_LIFETIME_LIMIT                               lib/entitlements.ts
 *   pricing                                            app/pricing/page.tsx
 *
 * The paid cap is 23MB, not the 25MB that shipped until 2026-09-13 — base64
 * inflates by 4/3 against Anthropic's 32MB request ceiling, so 25MB was above
 * what a request could carry (commit ececced).
 *
 * Re-running updates the existing row by slug, so this is the edit path too.
 *
 * Usage: npx tsx scripts/publish-converter-limits.ts [--dry-run]
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

const DRY_RUN = process.argv.includes("--dry-run");
const SITE = "https://www.invoicetodata.com";

const post = {
  title: "AI Bank Statement Converter: Password-Protected PDFs to Excel",
  slug: "ai-bank-statement-converter-limits-compared",
  meta_description:
    "Convert password-protected bank statements to Excel — the password stays in your browser. Any bank, any layout, up to 600 pages. First conversion free.",
  keywords:
    "ai bank statement converter, bank statement converter ai, password protected bank statement to excel, locked pdf bank statement converter, convert encrypted bank statement, bank statement pdf to excel ai, ai bank statement converter free, 600 page bank statement converter, scanned bank statement to excel",
  content: `Your bank sent the statements as PDFs. Some of them are password-protected. There are forty pages across six months and three accounts, and the spreadsheet they need to land in is due tomorrow.

That is the job. Here is how it goes.

## Locked statements open right here

Banks routinely protect statements with a password — a date of birth, part of an account number, a customer ID. Most converters simply refuse them, and leave you to open each file, re-save it without the password, and start again.

Drop a protected statement in and a password box appears. Enter it and the conversion carries on. No re-saving, no unlocking anything yourself, no separate step.

**The password never reaches our servers.** The file is unlocked inside your own browser, on your own machine, and only the unlocked pages go anywhere. We do not receive it, store it, or log it. For the key to your bank records, that is the only arrangement worth offering — and it is a property of how the thing is built, not a policy we promise to follow.

Forgotten which password your bank uses? The [converter](${SITE}/tools/bank-statement-to-excel) links to guides for 17 banks covering the convention each one follows.

## Six hundred pages in one go

A single document can run to **600 pages**. Twelve months across three accounts is roughly a hundred, so a full year of records is one upload and one download — not a file-by-file grind.

Files up to **23 MB**, which covers scanned statements as well as the ones you download from online banking. PDFs, and photographs too: JPG, PNG, WebP and GIF all work, so a picture of a statement taken on a phone converts the same as anything else.

## Any bank, any layout, no templates

Most extraction tools need a template per bank — a map telling the software where the date column sits on an HSBC statement versus a Chase one. Add a new bank, or your bank quietly redesigns its layout, and the extraction breaks.

There is no template here. The AI reads the page the way a bookkeeper does: it finds the transaction table, works out which column is the date and which is the balance, and handles multi-column layouts, continuation pages and running totals without being told the format in advance. A bank it has never seen works exactly like one it has.

That holds for scanned and photographed statements too, where the text has to be read off the image rather than lifted out of the file.

## You can prove nothing was dropped

The output carries the **running balance** from every row, not just the transactions.

This matters more than it sounds. A converter that returns a bare list of transactions gives you no way to know whether it missed one — and a single dropped row quietly breaks a reconciliation weeks later, when finding it is expensive. With the balance column, you check the final figure against your statement. If it matches, every row is there. One glance, and you are certain.

Paid conversions also categorise each transaction, so what comes out is closer to a coded ledger than a raw dump.

## Lands ready for Xero and QuickBooks

Exports as **XLSX or CSV**, already in the shape accounting software expects: date, description, separate debit and credit columns, balance. Column order and date formatting match what the importers want, so there is no remapping and no reformatting before the import.

## What it costs

**$2, once** — unlimited conversions for seven days. For a backlog with a deadline, this is the whole answer: two years of statements is one afternoon, and there is nothing to cancel afterwards.

**$5 a month** for 200 pages, or $39 a year, for ongoing monthly reconciliation.

**Free** — your first conversion, up to ten pages, with no account and no card. Enough to run your own statement through and see the output before deciding anything.

Most people converting bank statements are clearing a one-time pile rather than subscribing to a workflow. The week pass is priced for that, because charging a monthly fee for a task that finishes on Tuesday is the wrong shape.

## Start with your hardest statement

Not the tidy one — the protected one, or the scanned one, or the one with the layout that broke the last tool you tried. That is the file that tells you whether this works.

[Convert a bank statement to Excel](${SITE}/tools/bank-statement-to-excel) — first one is free, no account needed.

`,
};

async function run() {
  console.log(`Mode: ${DRY_RUN ? "DRY-RUN" : "PUBLISH"}\n`);
  console.log(`title: ${post.title}`);
  console.log(`slug:  ${post.slug}`);
  console.log(`meta:  ${post.meta_description.length} chars`);
  console.log(`words: ~${post.content.split(/\s+/).length}`);

  for (const banned of ["bankstatementconverters", "BankScanPro", "bankscanpro"]) {
    if (post.content.includes(banned) || post.title.includes(banned)) {
      console.error(`\nRefusing to publish: competitor name "${banned}" is back in the post.`);
      process.exitCode = 1;
      return;
    }
  }
  console.log("competitor-name check: clean");

  const { data: existing } = await supabase
    .from("blogs")
    .select("id, slug")
    .eq("slug", post.slug)
    .maybeSingle();

  if (DRY_RUN) {
    console.log(`\n${existing ? "Would UPDATE existing row." : "Would INSERT new row."}`);
    console.log("Dry-run — nothing written.");
    return;
  }

  if (existing) {
    const { error } = await supabase
      .from("blogs")
      .update({
        title: post.title,
        meta_description: post.meta_description,
        keywords: post.keywords,
        content: post.content,
      })
      .eq("slug", post.slug);
    if (error) {
      console.error(`Update failed: ${error.message}`);
      process.exitCode = 1;
      return;
    }
    console.log(`\nUpdated ${SITE}/blog/${post.slug}`);
    return;
  }

  const { error } = await supabase.from("blogs").insert(post);
  if (error) {
    console.error(`Insert failed: ${error.message}`);
    process.exitCode = 1;
    return;
  }
  console.log(`\nPublished ${SITE}/blog/${post.slug}`);
}

run();
