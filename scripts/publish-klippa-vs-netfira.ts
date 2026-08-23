/**
 * Publish the "Klippa vs Netfira" comparison, and retitle the Klippa
 * alternatives post around the Doxis rebrand.
 *
 * The gap: "klippa vs netfira" draws 43 impressions at position 28.7 with no
 * page on this site targeting it at all. Everything ranking for it is
 * incidental.
 *
 * Every factual claim below came from research done at publish time, not from
 * model memory — the failure mode this whole SEO pass has been unpicking is a
 * bot writing competitor comparisons from stale training data. The Klippa
 * alternatives post was generated thirteen months after Klippa was acquired
 * and never mentioned it.
 *
 * Sources consulted (August 2026):
 *   netfira.com and netfira.de — product scope, SAP focus, document types
 *   businesswire / doxis.com — SER Group acquisition of Klippa, March 2025
 *   itbrief.co.uk, globalbankingandfinance.com — Doxis rebrand, Jan 2026,
 *     DocHorizon name retired 30 March 2026
 *   fitgap / erpresearch — DocHorizon capability and pricing model summary
 *
 * Deliberately NOT asserted, because they could not be verified: Netfira
 * pricing, either vendor's customer counts beyond what Doxis published,
 * accuracy percentages, or head-to-head benchmark numbers. A comparison table
 * of invented checkmarks is what this article exists to avoid being.
 *
 * Usage:
 *   npx tsx scripts/publish-klippa-vs-netfira.ts --dry-run
 *   npx tsx scripts/publish-klippa-vs-netfira.ts
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

const POST = {
  slug: "klippa-vs-netfira",
  title: "Klippa vs Netfira: Which One Do You Actually Need?",
  meta_description:
    "Klippa (now Doxis) reads documents; Netfira connects suppliers to your ERP. Learn which problem you have before you compare features — and start free.",
  keywords:
    "klippa vs netfira, netfira alternative, klippa alternative, doxis ai.dp, invoice OCR vs supplier network, SAP invoice automation",
  summary:
    "Explains that Klippa and Netfira are not really competitors: Klippa (rebranded Doxis AI.dp after the March 2025 SER Group acquisition) is an intelligent document processing engine that reads documents you receive, while Netfira is a supplier-connection and ERP integration platform that automates structured B2B exchange including order confirmations and shipping notices. Gives a decision test based on whether the reader's bottleneck is reading documents or connecting suppliers, and covers where a lightweight converter fits instead.",
  content: `**These two tools are usually not alternatives to each other. Klippa — rebranded Doxis AI.dp after SER Group acquired it in March 2025 — reads documents that arrive in whatever shape they arrive in. Netfira connects your suppliers so structured documents arrive correctly in the first place, with a strong emphasis on SAP. If you are comparing them, the useful first question is not which is better but which problem you actually have.**

## Why this comparison is usually the wrong comparison

People land on "Klippa vs Netfira" because both appear in searches for invoice automation. But they sit at different points in the process, and picking between them on a feature list will produce the wrong answer.

- **Klippa / Doxis AI.dp** is an *intelligent document processing* engine. You hand it a PDF, a scan, a photo, or an email attachment, and it returns structured data. Its job starts the moment a document already exists in a messy format.
- **Netfira** is a *supplier connection and ERP integration* platform. Its stated purpose is exchanging transactional B2B documents — order confirmations, advance shipping notices, quotes, customer orders, invoices — and pushing that data into an ERP, with dedicated SAP support. Its job is to stop documents being messy upstream.

One reduces the cost of reading bad input. The other reduces how much bad input you receive. Those are different projects with different budgets and different stakeholders.

## What changed at Klippa (and why you may be searching now)

If you were evaluating Klippa and found the brand gone, this is the sequence:

| When | What happened |
|---|---|
| March 2025 | SER Group, a German enterprise content management vendor, acquired Klippa (Netherlands) |
| January 2026 | The group rebranded to **Doxis** |
| 30 March 2026 | The **DocHorizon** product name was retired |
| Now | Klippa DocHorizon is **Doxis AI.dp**; Klippa SpendControl is **Doxis SpendControl** |

Doxis reports the combined organisation at more than 3,000 customers and over 5 million users, and Klippa co-founder Yeelen Knegtering took a Chief AI Officer role. The direction is to fold document processing into a wider content platform covering archiving, workflow and case management.

Whether that helps or hurts depends on what you were buying. If you also need document management, a single platform is a real advantage. If you wanted a narrow tool that does one job cheaply, being inside an enterprise suite is the opposite of what you wanted.

## The decision test

Answer these three and the choice usually makes itself.

**1. Where does your data actually get stuck?**

If the answer is *"we receive PDFs from 200 suppliers and someone types them in"* — that is a document-reading problem. Doxis AI.dp addresses it, and so does any competent OCR tool, including much lighter ones.

If the answer is *"our POs and invoices never match and nobody knows which shipment arrived"* — that is a supplier-data problem. No OCR tool fixes it, because the errors are in the data, not the file format. Netfira's matching of invoices and shipping notices against orders and order lines is aimed squarely here.

**2. Do you run SAP?**

Netfira publishes a dedicated SAP solution, and that specificity matters. Generic "integrates with any ERP" claims and a purpose-built SAP path are not the same thing when you are the one doing the implementation.

**3. How many suppliers can you realistically get to change how they send you documents?**

This is the question that decides supplier-network projects and the one most often skipped. A platform that standardises supplier exchange only pays off if your suppliers actually adopt it. If you are a small team with limited leverage over who invoices you, that adoption effort may exceed the saving, and reading whatever arrives is the pragmatic path.

## Where a lightweight converter fits instead

There is a third possibility worth naming, because both platforms above are enterprise-shaped and plenty of teams do not need that shape.

If your real situation is *"I have a few hundred invoices or bank statements a month and I need them in a spreadsheet"*, an IDP platform is heavy machinery for the job. [InvoiceToData](https://invoicetodata.com) exists for exactly that: upload a PDF, get a structured Excel or CSV file, no template configuration and no supplier onboarding. The first conversion is free without an account, and pricing is published at [invoicetodata.com/pricing](https://invoicetodata.com/pricing) rather than quoted.

It is genuinely not the right tool if you need three-way matching against purchase orders, an SAP posting workflow, or an audit archive. Those are the cases the two platforms above are built for, and saying so is more useful than pretending one tool covers everything.

## Honest limits of this comparison

Netfira does not publish pricing, so any figure comparing the two on cost would be invented. Doxis publishes a consumption-based model with a small free credit to trial it, but not per-document rates for its tiers. Neither publishes head-to-head accuracy benchmarks that survive scrutiny, and vendor-run accuracy claims are not comparable across different document sets anyway.

What you can verify yourself, cheaply, before committing to either: take ten of your own worst documents — the crumpled scan, the multi-page statement, the supplier whose layout changes monthly — and run them through any trial you can get. Ten real documents from your own pile tell you more than any comparison table, including this one.

## Frequently Asked Questions

### Is Klippa still available?

Not under that name. The product is now Doxis AI.dp following SER Group's March 2025 acquisition and the January 2026 group rebrand; the DocHorizon name was retired on 30 March 2026. Existing capability moved with it — what changed is the brand, the surrounding platform, and the company you are contracting with.

### Is Netfira an alternative to Klippa?

Usually not, despite appearing in the same searches. Netfira automates structured document exchange with suppliers and integration into an ERP. Klippa, now Doxis AI.dp, extracts data from documents you have already received. Teams sometimes run both, because the two solve consecutive problems rather than the same one.

### Which is better for SAP?

Netfira publishes a dedicated SAP solution, which is a meaningful signal if SAP is where the data must land. Doxis, as part of an enterprise content platform, integrates broadly. The right test is not which claims SAP support but which one your implementation partner has actually delivered on your SAP version.

### Do I need either of these to convert invoices to Excel?

No. Converting a PDF invoice or bank statement to a spreadsheet is a much smaller job than either platform is built for, and a self-serve converter handles it in seconds without onboarding. You need a platform like these when the requirement grows into approval routing, PO matching, or retention and audit obligations.

### What should I check before switching after an acquisition?

Three things, in this order: whether your current pricing survives renewal, where a team of your size now sits on the roadmap, and whether your support path has changed. Ask them directly and get the answer in writing. An acquisition is not automatically bad news — but it does reset assumptions you agreed to with a different company.

## Conclusion

"Klippa vs Netfira" resolves once you stop treating it as a feature comparison. Klippa, now Doxis AI.dp, is for reading documents you cannot control. Netfira is for controlling how documents arrive, especially into SAP. And if your actual job is turning a stack of PDFs into a spreadsheet this afternoon, neither is what you need — [try a converter first](https://invoicetodata.com/tools/pdf-to-excel) and keep the platform decision for when the requirement genuinely grows into one.

Related: [Best Klippa Alternatives 2026](https://invoicetodata.com/blog/best-alternatives-to-klippa-7-top-tier-ai-invoice-ocr-solutions-for-2026) · [Convert PDF bank statements to Excel](https://invoicetodata.com/tools/bank-statement-to-excel)
`,
};

/** Retitle the alternatives post so the rebrand does the CTR work. */
const KLIPPA_RETITLE = {
  slug: "best-alternatives-to-klippa-7-top-tier-ai-invoice-ocr-solutions-for-2026",
  title: "Klippa Alternatives 2026 (Now Doxis): 7 Top Tools",
  meta_description:
    "Klippa is now Doxis AI.dp after the SER Group acquisition. Compare 7 alternatives on pricing, setup effort, and small-team fit — start free today.",
};

const POWER_WORD_RE = /(free|save|fast|easy|instant|step|guide|how to|best|top|quick|simple|automate)/i;
const CTA_RE = /(try|start|learn|discover|get|download|convert|extract|compare)/i;

function check(label: string, title: string, meta: string): string[] {
  const errs: string[] = [];
  if (title.length < 20 || title.length > 65) errs.push(`${label}: title ${title.length} chars (want 20-65)`);
  if (meta.length < 80 || meta.length > 165) errs.push(`${label}: meta ${meta.length} chars (want 80-165)`);
  if (!POWER_WORD_RE.test(meta) && !CTA_RE.test(meta)) errs.push(`${label}: meta lacks power word and CTA`);
  return errs;
}

async function run() {
  console.log(`Mode: ${DRY_RUN ? "DRY-RUN (no writes)" : "APPLY"}\n`);

  const errs = [
    ...check("new post", POST.title, POST.meta_description),
    ...check("retitle", KLIPPA_RETITLE.title, KLIPPA_RETITLE.meta_description),
  ];
  if (errs.length) {
    errs.forEach((e) => console.error(`FAIL ${e}`));
    process.exit(1);
  }
  console.log("Preflight OK (lengths + optimize-meta gates)\n");

  // Refuse to collide with an existing slug — the same hard-stop the content
  // cron now enforces.
  const { data: existing } = await supabase
    .from("blogs")
    .select("slug")
    .eq("slug", POST.slug)
    .maybeSingle();
  if (existing) {
    console.error(`Slug already exists: /blog/${POST.slug} — not overwriting.`);
    process.exit(1);
  }

  console.log(`NEW POST  /blog/${POST.slug}`);
  console.log(`  title (${POST.title.length}): ${POST.title}`);
  console.log(`  meta  (${POST.meta_description.length}): ${POST.meta_description}`);
  console.log(`  content: ${POST.content.length} chars, ${(POST.content.match(/^##\s/gm) ?? []).length} H2`);
  console.log();
  console.log(`RETITLE   /blog/${KLIPPA_RETITLE.slug}`);
  console.log(`  title (${KLIPPA_RETITLE.title.length}): ${KLIPPA_RETITLE.title}`);
  console.log(`  meta  (${KLIPPA_RETITLE.meta_description.length}): ${KLIPPA_RETITLE.meta_description}`);

  if (DRY_RUN) {
    console.log("\nDry-run — no writes.");
    return;
  }

  const { error: insertErr } = await supabase.from("blogs").insert({
    slug: POST.slug,
    title: POST.title,
    meta_description: POST.meta_description,
    keywords: POST.keywords,
    content: POST.content,
    summary: POST.summary,
  });
  if (insertErr) {
    console.error(`\nInsert failed: ${insertErr.message}`);
    process.exit(1);
  }
  console.log("\nPublished new post.");

  const { error: retitleErr } = await supabase
    .from("blogs")
    .update({
      title: KLIPPA_RETITLE.title,
      meta_description: KLIPPA_RETITLE.meta_description,
    })
    .eq("slug", KLIPPA_RETITLE.slug);
  if (retitleErr) {
    console.error(`Retitle failed: ${retitleErr.message}`);
    process.exit(1);
  }
  console.log("Retitled the alternatives post.");
}

run();
