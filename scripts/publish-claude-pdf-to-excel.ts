/**
 * Publish the post answering "Can Claude convert a PDF to Excel?"
 *
 * The LLM cluster is the best-performing thing on the site by position. From
 * the 2026-10-31 export, 24 queries, 325 impressions, 8 clicks:
 *
 *   110 imp   0 clk   pos 7.2   can claude convert pdf to excel
 *    78 imp   3 clk   pos 4.5   claude pdf to excel
 *    74 imp   4 clk   pos 4.0   claude convert pdf to excel
 *    29 imp   1 clk   pos 3.1   claude ai pdf to excel
 *
 * For comparison: one existing post in this cluster (gemini-vs-claude) drew
 * 944 impressions and 16 clicks, against 20 clicks for all 22 bank pages
 * combined.
 *
 * The 110-impression query is a yes/no question sitting at position 7 with
 * zero clicks — nothing on the site answers it in a title, so the click goes
 * to whoever does. This post is that title.
 *
 * Tone note: this is not a hit piece on chat. We run on Claude; saying its
 * extraction is poor would be both false and self-defeating. The honest
 * argument is that the reading is excellent and the plumbing around it —
 * a real file, long documents, a check that nothing was dropped — is what a
 * chat window does not provide.
 *
 * Trademark discipline, as elsewhere on the site: Claude is named
 * descriptively, as the model we run on and the subject of the question. It
 * is never used as the name of our own product or feature.
 *
 * Re-running updates the existing row by slug.
 *
 * Usage: npx tsx scripts/publish-claude-pdf-to-excel.ts [--dry-run]
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
const TOOL = `${SITE}/tools/pdf-to-excel`;
const BANK = `${SITE}/tools/bank-statement-to-excel`;

const post = {
  title: "Can Claude Convert a PDF to Excel? Yes — Here's How to Get a Real File",
  slug: "can-claude-convert-pdf-to-excel",
  meta_description:
    "Claude reads PDF tables accurately. Getting a working .xlsx out of a chat window is the harder part. Here is what works, and how to skip straight to the file.",
  keywords:
    "can claude convert pdf to excel, claude pdf to excel, claude convert pdf to excel, claude ai pdf to excel, ai pdf to excel converter, llm pdf to excel, claude pdf table extraction, convert pdf to spreadsheet ai",
  content: `Short answer: yes. Claude reads PDF tables — including scanned ones — and will give you the contents back as structured data. The reading is the part it is genuinely good at.

The friction is everything around the reading. A chat window gives you text in a message. What you wanted was a file you can open.

## What actually happens in the chat

Upload a PDF, ask for the table, and you get a markdown table in the reply. For a one-page invoice that is often enough — copy it, paste it into Excel, use Text to Columns, and you are done in two minutes.

Past about one page, the two-minute path stops being two minutes:

**You get text, not a spreadsheet.** Pasting a markdown table into Excel puts every row in column A. Splitting it back out is manual work that grows with the document, and pasted numbers arrive as text, so your sums return zero until you convert the column.

**Long documents drift.** Ask for forty pages of transactions in one go and the first pages come back clean. Later pages are where columns start merging or a date format quietly changes, because the whole document and the whole answer are competing for the same context. Splitting the PDF and pasting the pieces together is the usual workaround.

**Nothing tells you a row is missing.** This is the one that matters. A chat answer looks equally confident whether it captured 312 transactions or 309. For a bank or card statement, three missing rows is a reconciliation that will not close, found weeks later.

## The shortcut

This site runs on Claude. Same model doing the reading — with the three things above solved around it:

- **A real file.** XLSX or CSV, properly typed, numbers that sum. Or QIF, OFX, IIF and Tally XML if the destination is accounting software rather than a spreadsheet.
- **Long documents handled in pieces.** The PDF is split and the parts are read side by side, so page forty comes back as clean as page one, and the pages are reassembled in order.
- **A balance check on statements.** Where the statement carries a running balance, the output carries it too. Compare the closing figure to the last line of your statement — if it matches, nothing was dropped. That is the check a chat window cannot give you.

Also: password-protected PDFs open without you unlocking them first, scans and photographs convert the same as digital files, and there is no template to configure for a layout the tool has not seen before.

## Which to use

**Use the chat** for a single page, a quick look at what is in a document, or anything where you want to ask follow-up questions about the contents rather than get a file out.

**Use the converter** when the output is going somewhere — a spreadsheet, a bookkeeping system, a client's records — and it needs to be complete and correctly typed.

## Try it

[Convert a PDF to Excel](${TOOL}) — drag the file in, get the spreadsheet. First conversion is free, no account and no card.

Bank or credit card statement? [The statement converter](${BANK}) is the one you want — it produces one clean transaction table with the running balance carried through, instead of a copy of each page's layout.

---

*Claude is a product of Anthropic. This site is built on the Claude API and is not affiliated with or endorsed by Anthropic.*
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
