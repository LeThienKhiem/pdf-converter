/**
 * Publish the AI bank statement converter limits comparison.
 *
 * Written by hand rather than by the content cron because it names competitors
 * and quotes their prices. Every figure about another product was read off that
 * product's own site on 2026-09-13 and the post says so — a comparison built on
 * second-hand numbers is a liability, and specs move.
 *
 * Our own figures were read from the code the same day:
 *   FREE_MAX_BYTES / PAID_MAX_BYTES   app/api/extract/route.ts
 *   FREE_MAX_PAGES                    app/api/extract/route.ts
 *   GUEST_LIFETIME_LIMIT              lib/entitlements.ts
 *   ALLOWED_TYPES                     app/api/extract/route.ts
 *   pricing                           app/pricing/page.tsx
 *
 * The paid cap is 23MB, not the 25MB that shipped until 2026-09-13 — base64
 * inflates by 4/3 against Anthropic's 32MB request ceiling, so 25MB was above
 * what a request could carry. Publishing the old number would have advertised a
 * limit that failed.
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
  title: "AI Bank Statement Converter Limits Compared: File Size, Pages, Exports and Price",
  slug: "ai-bank-statement-converter-limits-compared",
  meta_description:
    "File size caps, page limits, export formats and real cost per page for three AI bank statement converters. Verified from each vendor's site, September 2026.",
  keywords:
    "ai bank statement converter, bank statement converter ai, bank statement converter file size limit, bank statement pdf to excel ai, ai bank statement converter free",
  content: `Most comparisons of AI bank statement converters list features. Features are easy to claim. The numbers that decide whether a tool works for you — how large a file it accepts, how many pages, what it exports, what it costs per page — are harder to find and are usually buried a click or two into a pricing page.

This page collects them. Every figure about another product was read off that product's own website on 13 September 2026, and the source is named so you can check it. Specs move; if you are reading this much later, verify before relying on it.

## The numbers

| | InvoiceToData | bankstatementconverters.ai | BankScanPro |
|---|---|---|---|
| Upload formats | PDF, JPG, PNG, WebP, GIF | PDF, JPG, PNG | PDF (digital or scanned) |
| Max file size | 5 MB free / 23 MB paid | 50 MB | not published |
| Password-protected PDFs | not supported | supported | not published |
| Export formats | XLSX, CSV | CSV, XLSX, JSON | XLSX, CSV, QBO |
| Free without an account | 1 conversion, up to 10 pages | free pages daily | 1 page |
| Entry price | $2 once — 7 days unlimited | $15/mo, 500+ pages | $19/mo, 200 pages |
| Cost of 200 pages a month | $5/mo | covered by the $15 plan | $19/mo |

Two of those rows go against us, and they are the first two. Worth being straight about that rather than burying it below a feature list.

## What a file size cap actually means

A 50 MB cap sounds ten times better than 5 MB. Whether it matters depends entirely on what your statements weigh, and most people have never looked.

Bank statement PDFs fall into two groups:

**Downloaded from online banking** — generated as text, typically **100 KB to 500 KB** for a monthly statement, rarely past 1 MB even at twelve months. These sit far below every cap on this page. If this is your situation, file size is not a real constraint anywhere and you should ignore that row entirely.

**Scanned or photographed** — a page scanned at 300 dpi in colour runs **1 to 3 MB per page**. Ten pages is 10 to 30 MB. This is where caps bite, and where a 5 MB free tier stops being enough.

So the honest version of that row: if you download statements from your bank, any of these tools will take your file. If you scan paper, check the cap before you commit, and ours will not be enough on the free tier.

There is a reason ours sits where it does rather than an oversight. The document is sent to the model inside the request, base64-encoded, and base64 inflates a file by one third. Against Anthropic's 32 MB request ceiling that puts the real limit at 24 MB of original file, which is why the paid cap is 23 MB and not a rounder number. Going past it means changing how the file is delivered, not raising a number.

## Page limits are the cap that usually bites first

File size gets quoted; page count is what actually runs out.

Our free tier converts the **first 10 pages** of a PDF and tells you how many were left. A year of monthly statements at 2 to 4 pages each is 24 to 48 pages, so a free conversion will cover a month or two, not a year. Paid conversions have no page limit from us — the ceiling is the model's, at 600 pages per document.

BankScanPro gives **one page** before you sign in, which is enough to see the output format and not much else. bankstatementconverters.ai publishes a daily free page allowance without stating the number, with more pages once you create a free account.

If you are evaluating, count the pages you actually need to convert this month before comparing prices. It changes which column wins more often than the price does.

## Export formats, and which ones matter

All three export **CSV and Excel**. The differences are at the edges:

**JSON** (bankstatementconverters.ai, and BankScanPro through a private API pilot) matters if you are feeding a system rather than opening a spreadsheet. For a developer it removes a parsing step. For everyone else it is noise.

**QBO** (BankScanPro) is QuickBooks' Web Connect format. It is the meaningful one for bookkeepers: a .qbo file imports into QuickBooks as bank transactions directly, while a CSV goes through the import wizard and column mapping every time. If you reconcile in QuickBooks weekly, that difference is real. We do not offer QBO today.

We export XLSX and CSV, laid out for Xero and QuickBooks import — column order, date format, and separate debit and credit columns — but the import still goes through the wizard.

## Password-protected statements

Plenty of banks deliver statements as password-protected PDFs. HSBC, Barclays and several Indian and Southeast Asian banks do it by default, usually keyed to a date of birth, an account number fragment, or a customer ID.

bankstatementconverters.ai states support for these. We do not: an encrypted PDF cannot be read without the password, and we have no way to take one from you today. **If your statement is password-protected, open it in your PDF reader with the password, re-save or print it to a new unprotected PDF, then upload that.** Every major PDF reader can do this, and it takes about fifteen seconds.

The [converter page](${SITE}/tools/bank-statement-to-excel) links to guides for 17 specific banks, each covering that bank's password convention if you have forgotten what yours is — but the removal step is still yours for the moment.

## Price, per page rather than per month

Headline monthly prices hide the thing worth comparing.

- **BankScanPro** — $19/mo for 200 pages, $75/mo for 3,000. That is **9.5 cents a page** at the entry tier, dropping to 2.5 cents at volume.
- **bankstatementconverters.ai** — from $15/mo for 500+ pages, API access included. Roughly **3 cents a page**, with the caveat that "500+" is not an exact number.
- **InvoiceToData** — $5/mo for 200 pages, or $39 a year. That is **2.5 cents a page**. There is also a **$2 one-time week pass**, unlimited for seven days, which is the cheapest way to clear a backlog without starting a subscription.

For a bookkeeper converting a couple of hundred pages a month, the spread between $5 and $19 for the same volume is the largest single difference on this page — larger in practical terms than the file size row that looks more dramatic.

## Which one to use

**Download statements from online banking, convert a few hundred pages a month, reconcile in Xero or a spreadsheet** — our numbers are the strongest here. Files are small enough that no cap applies, and $5/mo against $19/mo for the same 200 pages is the whole argument. Start with the [AI bank statement converter](${SITE}/tools/bank-statement-to-excel); the free conversion covers ten pages without an account.

**Reconcile in QuickBooks and value a direct import** — BankScanPro's QBO export removes a manual step from every single import. If you do this weekly, that is worth more than the price difference.

**Scan paper statements, or your statements are password-protected** — bankstatementconverters.ai is the better fit today. A 50 MB cap absorbs scanned files that ours will not, and password support saves you the unlock step.

**Feeding another system rather than a spreadsheet** — JSON output is worth the look, from either of the other two.

## One-time backlog versus ongoing work

Worth separating, because the pricing answer flips.

A **one-time backlog** — two years of statements for a loan application, a migration, a cleanup — is a fixed pile of pages you convert once. A week pass at $2 or a pay-per-use pack is cheaper than any subscription, and page limits matter more than monthly price.

**Ongoing monthly reconciliation** is a steady low volume where cost per page compounds and export format decides how long each cycle takes. Here the QBO question and the per-page rate matter more than any cap.

Most people comparing converters are doing the first and pricing for the second.

---

*All third-party figures read from each vendor's own website on 13 September 2026. Our own figures are the values in our code on that date. Pricing and limits change — check the source before relying on any of this.*
`,
};

async function run() {
  console.log(`Mode: ${DRY_RUN ? "DRY-RUN" : "PUBLISH"}\n`);
  console.log(`title: ${post.title}`);
  console.log(`slug:  ${post.slug}`);
  console.log(`meta:  ${post.meta_description.length} chars`);
  console.log(`words: ~${post.content.split(/\s+/).length}`);

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
