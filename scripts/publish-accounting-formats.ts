/**
 * Publish the post introducing the accounting export formats.
 *
 * Written by hand rather than by the content cron, which was switched off on
 * 2026-10-18 — 132 generated posts had produced 27 clicks between them. This
 * one exists because there is something to announce, not because a schedule
 * fired.
 *
 * Targets the format-pair queries a competitor gap analysis surfaced:
 * bankstatementconverters.ai runs 20 pages on csv-to-qif, excel-to-tally and
 * the like, and we had nothing for any of them until the writers shipped.
 *
 * Claims limited to what is true as of 2026-10-20:
 *   - QIF, OFX, IIF, Tally XML are implemented and tested (lib/accountingFormats.ts)
 *   - QBO and QFX are not, and the post says why rather than going quiet on it
 *   - OFX into QuickBooks Online is documented by Intuit but not yet verified
 *     by us against a real upload, so it is described as what Intuit lists
 *
 * Re-running updates the existing row by slug.
 *
 * Usage: npx tsx scripts/publish-accounting-formats.ts [--dry-run]
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
const TOOL = `${SITE}/tools/bank-statement-to-excel`;

const post = {
  title: "Bank Statement to QIF, OFX, IIF and Tally — Not Just Excel",
  slug: "bank-statement-to-qif-ofx-iif-tally",
  meta_description:
    "Convert a PDF bank statement straight into the file your accounting software imports: QIF, OFX, IIF or Tally XML, alongside Excel and CSV. No column mapping.",
  keywords:
    "bank statement to qif, bank statement to ofx, pdf to qif converter, pdf to ofx converter, bank statement to tally, pdf statement to iif, quickbooks online bank statement import, quicken qif import, tally bank statement import",
  content: `A spreadsheet is not what most people actually need. If the statement is going into QuickBooks, Quicken or Tally, an .xlsx file means opening the import wizard, matching columns by hand, fixing the date format, and doing the same thing again next month.

The converter now writes the file your software imports directly. Same extraction, different envelope.

## What you can download

| Format | For |
|---|---|
| **XLSX** | Excel, Google Sheets, anything spreadsheet-shaped |
| **CSV** | Generic imports, custom systems |
| **QIF** | Quicken, GnuCash, YNAB, Banktivity |
| **OFX** | QuickBooks Online, Quicken, Xero, MoneyWiz |
| **IIF** | QuickBooks Desktop |
| **Tally XML** | Tally ERP and TallyPrime |

Upload the PDF once, then pick a format. The transactions, dates, debit and credit columns and running balance are the same in all six — only the file wrapper changes.

## Why the running balance still matters here

Every format carries the balance where the statement had one, and that is the check worth making after any import. Compare the closing figure in your software against the last line of the statement. If it matches, every transaction made it across.

A converter that hands you a bare list of transactions gives you no way to notice a missing one, and a single dropped row surfaces weeks later as a reconciliation that will not close.

## QuickBooks: which file to pick

**QuickBooks Online** — download the **OFX**. Intuit's help pages list .ofx among the file types the manual bank upload accepts, alongside .csv, .qbo and .qfx.

**QuickBooks Desktop** — download the **IIF**. It is Intuit's own tab-delimited import format for the desktop product.

## About QBO and QFX

These are the two formats people ask for most, and we do not produce them. Worth explaining rather than leaving as a gap on a feature list.

A .qbo file is an OFX with an Intuit Branding ID inside it. Intuit's partner documentation describes that identifier as "directly associated with a contracted Intuit Branding ID" — it belongs to an agreement between Intuit and a bank, and QuickBooks checks the value against the institutions covered by one.

Converters that offer PDF-to-QBO put a bank's identifier into a file they generated themselves, which makes the file claim to have come from that bank's Web Connect service. We are not willing to label your financial data as having a source it does not have, so the OFX writer leaves the field out. QFX works the same way on Quicken's side.

In practice this costs less than it sounds: OFX covers QuickBooks Online, IIF covers QuickBooks Desktop, and QIF covers Quicken.

## Tally

Tally is the common case in India and gets a proper XML import envelope rather than a CSV you have to shape yourself. Money in becomes a Receipt voucher, money out a Payment voucher, each with the paired ledger entries Tally expects.

The bank ledger is named generically, because we do not know your chart of accounts. Tally prompts for an unrecognised ledger on import rather than failing, so you remap it once to the account you actually use.

## Rows that are not transactions

Opening balances, closing balances and summary lines are left out of all four accounting formats, and kept in the spreadsheet.

The reason is that an accounting import reads a dated row with no amount as a real transaction and posts it. Your reconciliation then carries entries that were never money moving. The spreadsheet shows you the whole statement; the import file carries only what belongs in a ledger.

## Try it

[Convert a bank statement](${TOOL}) — upload the PDF, pick your format. First conversion is free, no account needed.

Password-protected statement? [That works too](${SITE}/tools/password-protected-bank-statement-to-excel) — the password is entered in the converter and never leaves your browser.

---

*Formats as of 20 October 2026. QBO and QFX are not offered, for the reason above.*
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
    .select("id")
    .eq("slug", post.slug)
    .maybeSingle();

  if (DRY_RUN) {
    console.log(`\n${existing ? "Would UPDATE" : "Would INSERT"}. Nothing written.`);
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
