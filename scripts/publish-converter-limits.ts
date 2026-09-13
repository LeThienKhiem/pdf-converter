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
  title: "AI Bank Statement Converter Limits: File Size, Pages, Exports and Price",
  slug: "ai-bank-statement-converter-limits-compared",
  meta_description:
    "Exact limits for converting bank statements to Excel with AI: file size caps, page counts, export formats and cost per page — and what each number means.",
  keywords:
    "ai bank statement converter, bank statement converter ai, bank statement converter file size limit, bank statement pdf to excel ai, ai bank statement converter free, convert bank statement to excel",
  content: `Before you upload anything to a bank statement converter, four numbers decide whether it will work for you: how large a file it takes, how many pages it reads, what it gives you back, and what that costs. Most tools bury these a click or two into a pricing page.

Here are ours, in full, along with what each number means once you are holding a real statement.

## The numbers

| | Free | Paid |
|---|---|---|
| Max file size | 5 MB | 23 MB |
| Pages per document | first 10 | up to 600 |
| Upload formats | PDF, JPG, PNG, WebP, GIF | same |
| Export formats | XLSX, CSV | XLSX, CSV |
| Account required | no — 1 conversion | yes |
| Price | free | $2 for 7 days unlimited, or $5/mo for 200 pages |

Everything below is context for those rows. If you only needed the numbers, you have them.

## What the file size cap actually means

A megabyte figure is meaningless until you know what your statements weigh, and most people have never looked. There are two cases and they are far apart.

**Downloaded from online banking.** Generated as text, these run **100 KB to 500 KB** for a monthly statement and rarely pass 1 MB even for a full year. If this is you, the file size cap is not a constraint at all — you could convert twenty statements at once and stay inside the free tier's 5 MB.

**Scanned or photographed.** A page scanned at 300 dpi in colour runs **1 to 3 MB**. Ten pages is 10 to 30 MB. This is where a cap bites: a scanned statement of any length will exceed the 5 MB free tier, and a long one can pass 23 MB.

Two things help if you are scanning. Scanning in greyscale rather than colour typically cuts the file by half to two thirds with no loss of legibility for text and numbers. Dropping from 300 dpi to 200 dpi roughly halves it again and is still comfortably readable by the model. A 30 MB colour scan becomes a 6 MB greyscale one with no meaningful change in extraction accuracy.

The 23 MB paid figure is not a round number for a reason. The document is sent to the model inside the request, base64-encoded, and base64 inflates a file by one third. Against the 32 MB request ceiling that puts the true limit at 24 MB of original file, so the cap sits just below it. Going past that means changing how the file is delivered, not raising a number.

## Page limits are the cap that usually bites first

File size gets quoted. Page count is what actually runs out.

A free conversion reads the **first 10 pages** of a PDF and tells you how many were left behind, so you can see the output quality on your own statement before deciding anything. Monthly statements run 2 to 4 pages, so ten pages covers a month or two — enough to judge the result, not enough for a year of records.

Paid conversions have no page limit from us. The ceiling is the model's, at **600 pages** per document. For context, twelve months of statements across three accounts is roughly 100 pages, so this is not a limit most people will meet.

If you are working out what you need, count pages rather than files. Someone converting two years of statements for a mortgage application is looking at 50 to 100 pages — one $2 week pass, not a subscription.

## What comes out

**XLSX and CSV**, laid out for accounting import: date, description, separate debit and credit columns, and running balance where the statement carries one. Column order and date formatting already match what Xero and QuickBooks expect, so the import wizard needs no remapping.

The running balance matters more than it sounds. Many converters return a flat list of transactions; without the balance column you cannot check that the extraction is complete, because a missed row shows up as a balance that stops reconciling. With it, one glance at the last row against your statement confirms nothing was dropped.

Paid conversions also categorise transactions, which turns a raw export into something closer to a coded ledger.

What we do not export today is **QBO**, QuickBooks' Web Connect format, which imports as bank transactions directly and skips the wizard. If you reconcile in QuickBooks every week, that is a real difference and worth knowing before you commit — our CSV still imports, it just goes through column mapping each time.

## Password-protected statements

Plenty of banks send statements as password-protected PDFs, usually keyed to a date of birth, part of an account number, or a customer ID.

**Enter the password in the converter and it opens the file for you.** Drop the
statement in as normal; when it turns out to be protected, a password box
appears, and the conversion continues from there. No re-saving, no unlocking it
yourself first.

**The password never reaches our servers.** Decryption happens in your own
browser — the file is unlocked on your device and only the unlocked pages are
sent for extraction. We never receive, store, or log the password, which for
the key to your bank records is the only arrangement worth offering.

If you cannot remember the password, the [converter page](${SITE}/tools/bank-statement-to-excel)
links to guides for 17 banks covering the convention each one uses — usually a
date of birth, part of an account number, or a customer ID.

Two limits worth knowing. Unlocking is capped at 120 pages per file, which is
past anything a normal statement reaches. And an unlocked statement is read as
images rather than text, the same way a scanned statement is, because the step
that removes the password also flattens the page — accurate in practice, and
the reason an unprotected original is still the better input when you have one.

## Price, per page rather than per month

Monthly headline prices hide the number that matters.

- **$2 once** — unlimited conversions for seven days. For a fixed backlog, this is almost always the cheapest route: two years of statements is a single afternoon inside one week pass.
- **$5 a month** — 200 pages, which is **2.5 cents a page**. Or $39 a year.
- **Free** — one conversion of up to ten pages, no account, which exists so you can check the output on your own statement before paying anything.

The reason the week pass is priced the way it is: most people converting bank statements are clearing a one-time pile, not subscribing to a workflow. Charging a monthly fee for a task that finishes on Tuesday is the wrong shape.

## A backlog and a routine are different problems

Worth separating, because the right answer flips between them.

**A one-time backlog** — statements for a mortgage or loan application, a migration to new accounting software, a cleanup before year end. Fixed pile, converted once. Page count decides what you need and the week pass covers almost all of these.

**Ongoing monthly reconciliation** — a steady low volume where cost per page compounds over a year and the shape of the export decides how long each cycle takes. Here the monthly plan is the right instrument, and 2.5 cents a page is what it works out to.

Most people comparing converters are doing the first while pricing for the second, and end up paying for months they will not use.

---

*Figures current as of 13 September 2026 and taken from the running service, not from a marketing page. Limits and pricing change — the [converter](${SITE}/tools/bank-statement-to-excel) and [pricing page](${SITE}/pricing) always carry the live numbers.*
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
