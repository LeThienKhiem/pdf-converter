import { NextResponse } from "next/server";
import { SEO_MODEL, extractText, getAnthropic } from "@/lib/anthropic";
import { getSupabase, hasSupabaseConfig } from "@/lib/supabase";
import { sendTelegramMessage } from "@/lib/telegram";
import {
  proposeAndScoreCandidates,
  formatLockedAngle,
  pickDiversityAxes,
  formatDiversityAxes,
  criticReview,
  formatCriticVerdict,
  mechanicalDupeCheck,
  pickRelevantLinkTargets,
  normalizeTitle,
  researchCurrentFacts,
  templateNeedsResearch,
  type RecentPost,
} from "@/lib/seoContent";

/** Reject any candidate whose Haiku-scored similarity vs corpus is >= this. */
const DEDUP_THRESHOLD = 65;

/**
 * How many corpus titles to name in the writer prompt as "don't retread
 * these". The planner sees the whole corpus; the writer only needs the
 * nearest neighbours, and listing 120 titles would crowd out the brief.
 */
const AVOID_LIST_SIZE = 25;

/**
 * Vercel Cron Job — runs daily at 1:00 AM UTC (8:00 AM VN)
 * Automatically generates SEO blog content using Claude, publishes to Supabase,
 * and pings Google to re-crawl sitemap
 */

/**
 * Internal pages to link to in blog content.
 *
 * Ordered by what Search Console says actually earns clicks, because the blog
 * is where the site's internal link equity comes from and this list decides
 * where it goes. Over 90 days:
 *
 *   /tools/bank-statement-to-excel   795 imp   16 clicks   2.01%
 *   /tools/pdf-to-excel              839 imp   15 clicks   1.79%
 *   /                                323 imp   12 clicks   3.72%
 *   /tools/pdf-to-gsheet               0 imp    0 clicks      —
 *
 * The bank converter is the single biggest click-earner on the site and was
 * absent from this list entirely, so none of the 122 published posts linked to
 * it. /tools/pdf-to-gsheet was on the list and has never recorded a single
 * impression. It stays — it is a working tool, and a link from a relevant post
 * is how it might start earning some — but it is no longer above the pages
 * that do the converting.
 *
 * Hosts are www, matching sitemap.ts, robots.ts, layout's metadataBase and the
 * live canonical tags. The bare host 308s, so the previous entries sent every
 * internal link in every post through a redirect.
 */
const INTERNAL_LINKS = [
  { url: "https://www.invoicetodata.com/tools/bank-statement-to-excel", anchor: "bank statement to Excel converter" },
  { url: "https://www.invoicetodata.com/tools/pdf-to-excel", anchor: "PDF to Excel converter" },
  { url: "https://www.invoicetodata.com", anchor: "InvoiceToData" },
  { url: "https://www.invoicetodata.com/tools/pdf-to-gsheet", anchor: "PDF to Google Sheets" },
  { url: "https://www.invoicetodata.com/blog", anchor: "our blog" },
];

/**
 * SEO content calendar.
 *
 * `weight` is how many slots a template gets in the rotation, set from
 * measured Search Console demand rather than by gut feel. Grouping the
 * 90-day query export by theme:
 *
 *   head commercial (invoice ocr / data extraction)  2697 imp, best pos 41.6
 *   bank statement                                    291 imp, best pos 55.3
 *   alternative / competitor                          246 imp, best pos 11.3
 *   LLM (claude / gemini)                             119 imp, best pos  7.6
 *   conversational questions                           54 imp
 *   non-invoice document types                         32 imp
 *   accounting integrations                            25 imp
 *
 * The alternative/competitor cluster carries the most weight because it is by
 * far the closest to page one — position 10.8 on 70 impressions for "klippa
 * alternative", against 41.6 at best for the head terms. Competitors don't
 * publish "alternatives to ourselves", so it is winnable ground; the head
 * terms mean outranking ABBYY and Rossum on their own turf.
 *
 * Weights matter because rotation used to be uniform, and adding five
 * templates in one go silently cut the best-evidenced category from one run
 * in seven to one in twelve. Uniform rotation treats a 32-impression theme as
 * equal to a 246-impression one.
 *
 * ── Reweighted 2026-08-29, after the first check with real post-change data ──
 *
 * Impressions alone turned out to be the wrong thing to optimise. The 90-day
 * export showed 49 pages holding an average position <= 10 and returning zero
 * clicks between them, on 897 impressions. Ranking on page one and being
 * clickable are different properties, and the split is search intent:
 *
 *   Claude cluster                    89 imp   4 clicks   4.5% CTR
 *   vendor name alone (navigational)  45 imp   0 clicks   0.0% CTR
 *   generic / problem                 33 imp   0 clicks   0.0% CTR
 *   vendor + comparison               3 imp    0 clicks
 *
 * The "vendor name alone" row is where the comparison posts landed. A page
 * titled "InvoiceToData vs Mindee" gets no searches for its own title — this
 * is a six-month-old brand nobody looks up — so what it actually ranks for is
 * "mindee invoice ocr" and "mindee invoice ocr api pricing official". Those
 * searchers want Mindee's own site. Position 9 as an unfamiliar competitor
 * earns nothing there, and no title rewrite changes that; the intent is
 * wrong, not the snippet. 306 impressions on invoicetodata-vs-mindee have
 * produced zero clicks since it was published.
 *
 * So `comparison` drops 3 -> 2 and its prompt now defaults to comparing two
 * competitors against each other, where the searcher is genuinely undecided
 * and we can appear as the third option. "klippa vs netfira" arrives 48 times
 * a quarter with no page to meet it; "invoicetodata vs klippa" arrives never.
 *
 * The slots move to the three themes with evidence of clickable intent:
 * `alternative` (3 -> 4, the site's best commercial position), `llm-workflow`
 * (1 -> 2, the only cluster converting at all), and `direct-answer` (1 -> 2,
 * whose conversational queries reach page one on the right intent).
 *
 * `llm-workflow` deliberately stops at 2 despite the best CTR on the site:
 * the whole cluster depends on Anthropic's product naming, which is a
 * dependency to hedge rather than concentrate into. See its prompt.
 */
type ContentTemplate = { type: string; weight: number; prompt: string };

const CONTENT_TEMPLATES: ContentTemplate[] = [
  {
    type: "comparison",
    weight: 2,
    prompt: `Write a detailed comparison article for the invoice OCR software market.

DEFAULT MODE — compare TWO COMPETITORS against each other, not against us.
Pick two from: Klippa, Nanonets, Rossum, Docsumo, Mindee, ABBYY, Veryfi, Netfira, Amazon Textract, Hypatos, Ocrolus.
Title it plainly as "X vs Y" — that is the phrase people actually search.

Why this way round, because it is the opposite of what this template used to say:
The earlier version asked for "X vs InvoiceToData" every time. Nobody searches
that. This is a six-month-old brand; its name has no query volume. What those
articles ended up ranking for instead was the competitor's own name — queries
like "mindee invoice ocr api pricing official", where the searcher wants
Mindee's website. We rank around position 9 on those and have never once been
clicked. "klippa vs netfira", by contrast, arrives about 48 times a quarter
from someone genuinely choosing between two vendors and committed to neither.

Write it as an evaluation someone comparing those two would find useful:
features, pricing, accuracy, deployment model, integrations, and who each one
actually suits. Be even-handed — the reader can tell when a comparison has a
thumb on the scale, and a visibly rigged one loses the reader for both names.

Mention InvoiceToData ONCE, in a short closing section, as a third option
worth knowing about for readers whose volume or budget suits neither. One
honest paragraph, not a pitch. If it does not fit naturally, leave it out and
let the internal links do that work.

Only compare against InvoiceToData directly if the pairing genuinely has
search demand behind it — which today it does not.
DO NOT pick a pairing an existing article already covers.`,
  },
  {
    type: "how-to",
    weight: 2,
    prompt: `Write a detailed how-to guide about invoice data extraction or PDF processing.
Choose a specific practical topic like:
- How to extract data from PDF invoices automatically
- How to convert invoices to Excel spreadsheets
- How to automate accounts payable with OCR
- How to set up invoice OCR for your small business
- How to extract line items from invoices
- How to batch process invoices
Include step-by-step instructions and mention InvoiceToData as a recommended solution.`,
  },
  {
    type: "listicle",
    weight: 2,
    prompt: `Write a "Top X" or "Best X" listicle article about invoice processing or accounting automation.
Choose a specific topic like:
- Best invoice OCR tools for small businesses
- Top ways to reduce manual data entry in accounting
- Best practices for invoice digitization
- Top invoice automation trends in 2026
- Best free tools to extract data from PDFs
Include InvoiceToData in the list and position it as a top choice.`,
  },
  {
    type: "industry",
    weight: 1,
    prompt: `Write an informative article about trends and developments in invoice processing, AP automation, or OCR technology.
Choose a specific angle like:
- The future of AI in invoice processing
- How OCR technology is transforming accounts payable
- Why businesses are switching from manual to automated invoice processing
- The ROI of invoice automation for SMBs
- How AI invoice extraction reduces errors and saves time
Naturally mention InvoiceToData as an example of modern solutions.`,
  },
  {
    type: "use-case",
    weight: 1,
    prompt: `Write a use-case or scenario-based article showing how InvoiceToData solves real business problems.
Choose a specific industry or scenario:
- Invoice processing for e-commerce businesses
- How freelancers can automate expense tracking
- Invoice OCR for accounting firms managing multiple clients
- Automating invoice processing for construction companies
- How restaurants and hospitality use invoice OCR
Include practical tips and a clear CTA to try InvoiceToData.`,
  },
  {
    type: "glossary",
    weight: 1,
    prompt: `Write a comprehensive glossary/explainer article about a key concept in invoice processing or OCR.
Choose a topic like:
- What is Invoice OCR? Complete Guide for 2026
- Invoice Data Extraction Explained: How It Works
- What is Accounts Payable Automation?
- Understanding Intelligent Document Processing (IDP)
- OCR vs AI Data Extraction: What's the Difference?
Make it thorough, educational, and naturally link to InvoiceToData as a solution.`,
  },
  {
    type: "alternative",
    weight: 4,
    prompt: `Write a "Best Alternatives to X" article targeting users searching for alternatives to a popular tool.
Choose ONE tool: "Best Alternatives to ABBYY", "Best Alternatives to Nanonets", "Best Alternatives to Klippa", "Best Alternatives to Rossum", "Best Alternatives to Docsumo".
List 5-7 alternatives including InvoiceToData as the #1 recommended alternative.
Include pros, cons, pricing, and use-case fit for each.`,
  },

  // ─── Templates below target demand the first seven never reached ──────
  //
  // The seven templates above are all invoice-OCR framings. Measured on the
  // live corpus, "invoice" appears in 71% of published titles and "ocr" in
  // 33% — the bot had effectively exhausted its topic space, which is why the
  // dedup gate was rejecting most runs and cadence had fallen to one post
  // every 4.3 days. More prompt variety could not fix that; only new subject
  // matter could.
  //
  // Each template below is anchored to queries the site already receives.
  //
  // On reading the evidence honestly: these are EXPLORATORY. The queries cited
  // are real, but most carry single-digit impressions over 90 days, where an
  // average position is close to meaningless — a post at "position 8" may have
  // surfaced twice in three months. An earlier version of these prompts quoted
  // those positions and click-through rates as proven demand, which overstated
  // what the data supports and would have had the writer arguing from figures
  // that cannot bear the weight.
  //
  // They are still worth writing, for a reason that does not depend on current
  // volume: the competition is thin and the topics are adjacent to what we
  // genuinely do. That is a bet on where demand is going, and the prompts now
  // say so rather than dressing it up as measurement.

  {
    type: "llm-workflow",
    weight: 2,
    prompt: `Write about using a general-purpose AI assistant to get data out of documents and into a spreadsheet.

Why this topic, and its two real limits — read both before writing:

This is the only theme in Search Console converting at all. On the latest 90-day export it took 89 impressions to 4 clicks — a 4.5% click-through rate, and a third of every click the site received — while 897 impressions across 49 blog pages ranking on page one produced zero. Still a small sample, so treat it as encouraging rather than proven; the point is not the exact rate but that this is the one place where ranking has actually turned into visits. Competition is thin and we can speak to Claude with first-hand authority, since the product runs on it.

LIMIT 1 — the intent is DIY, not purchase. Someone searching "claude convert pdf to excel" wants to do it themselves, for free. Anthropic's own help centre ranks on that query, teaching them exactly that. Writing a sales pitch into this traffic converts badly and reads badly. Write genuinely useful DIY instructions, and be honest about where the manual approach stops scaling — the reader who hits that wall in three months is the one worth earning. Do not oversell.

LIMIT 2 — this traffic is borrowed, not owned. The whole cluster hangs on Anthropic's product naming. A rename, or Claude's own file-creation features expanding, and the query disappears. So do not build the article as though this keyword is an asset: make the transferable part (the workflow, the failure modes, the volume threshold) the substance, and the specific tool a detail.

Queries in this space (low volume individually, so don't lean on the numbers):
  "claude pdf to excel", "claude ai pdf to excel", "can claude convert pdf to excel",
  "claude convert pdf to excel", "gemini ocr"

Pick ONE specific angle, for example:
- Can Claude convert a PDF to Excel? What works and where it breaks down
- Claude vs ChatGPT vs Gemini for pulling tables out of PDFs
- Using the Claude API to extract invoice data (developer walkthrough, real code)
- Why a chat window is the wrong place to convert fifty bank statements
- What a vision model actually "sees" when it reads a PDF table

Be genuinely useful and honest, including about the limits: context windows, per-file manual effort, no batch processing, inconsistent output shape between runs, no direct .xlsx export. InvoiceToData runs on Claude, so the honest framing is "same underlying model, wrapped in the workflow a repeated task needs" — not "AI assistants are bad".
Write for someone who has already tried pasting a PDF into a chat window.`,
  },
  {
    type: "bank-export",
    weight: 2,
    prompt: `Write a practical guide to getting transaction data out of a specific bank and into a spreadsheet.

Why this topic: bank-statement intent is the broadest long-tail cluster the site receives — 87 distinct queries over 90 days. Individually they are tiny, but together they total 291 impressions, and the best of them still sits around position 55, so there is demand arriving with no strong page to meet it. The programmatic pages at /tools/bank/{slug} already exist to catch it.

Representative queries (each low-volume on its own — the value is in the aggregate, not any single one):
  "how to download chase statements as csv", "chase export transactions to excel",
  "how to download hsbc statements in csv", "amex download statement as csv",
  "how to download citibank statement in excel", "convert bank of america statement to excel"

Pick ONE bank and cover it properly: Chase, Bank of America, Wells Fargo, Citi, Capital One, Amex, HSBC, Barclays, PNC, TD Bank, US Bank, Discover.

Cover: which export formats that bank actually offers, when the native CSV export is enough (say so plainly — don't push a conversion the reader doesn't need), what to do when only PDF statements exist (older records, closed accounts, international branches), how to handle password-protected downloads, and how to get the result into QuickBooks or Xero.

Only state things that are generally true and stable. Do NOT invent exact menu paths, button labels, or screen names — online banking UIs change constantly and a wrong instruction is worse than a general one. Link to the matching page at /tools/bank/{bank-slug} where one exists.`,
  },
  {
    type: "document-type",
    weight: 1,
    prompt: `Write about extracting data from a document type that is NOT an invoice.

Why this topic: "invoice" appears in 71% of published titles, so the corpus has almost no coverage of anything else — which is both a dedup problem and a coverage gap. Be clear-eyed that the measured demand here is currently thin (roughly 32 impressions across these queries over 90 days), so this is exploratory rather than chasing proven volume. It earns its slot by widening what the site can rank for at all.

Queries seen (all low-volume — do not cite them as evidence of scale):
  "remittance advice ocr", "quotation ocr", "rent invoice data extractor",
  "reduce manual acord form data entry", "multi-page invoice ocr"

Pick ONE document type and treat it as its own subject with its own quirks: receipts and expense reports, purchase orders, payslips and payroll registers, remittance advice, quotes and estimates, freight and BOL documents, rent rolls and lease schedules, insurance forms, tax forms, utility bills, or medical billing statements.

Cover what fields matter for that document, the structural quirks that make it harder than an invoice (multi-column layouts, repeating groups, totals that must reconcile, per-line tax), what to check in the output before trusting it, and where the data usually needs to land.
Mention invoices only where the comparison genuinely helps. This article should be about the other document.`,
  },
  {
    type: "integration",
    weight: 1,
    prompt: `Write a guide to moving extracted document data into one specific downstream system.

Why this topic: extraction is only half the job — the reader's actual goal is data sitting correctly in their accounting system, and the site has no page covering that last step. Measured demand is small so far (about 25 impressions across these queries over 90 days), so this is exploratory. It earns its slot because it targets the moment of highest intent: someone who already has the file and is stuck on the import.

Queries seen (low-volume — don't present them as scale):
  "integrate ocr data with quickbooks online automatically",
  "dynamically pull invoices from xero to google sheets",
  "xero automate data extraction", "quickbooks ocr", "bai to excel converter"

Pick ONE destination: QuickBooks Online, Xero, Sage, Wave, NetSuite, FreshBooks, Google Sheets as a live control layer, Excel Power Query, or a plain CSV import into a custom system.

Cover the actual mechanics: what column layout that system expects, how dates and amounts must be formatted, how to handle multi-currency, what its importer rejects and why, how to reconcile against existing records, and what to do about duplicates on a re-import.
Be concrete about field mapping — a table showing source field to destination field is the most useful thing this article can contain.`,
  },
  {
    type: "direct-answer",
    weight: 2,
    prompt: `Write a focused article that answers ONE specific question completely and immediately.

Why this topic: full-sentence, conversational queries are showing up in Search Console — the shape of query that comes from someone talking to an AI assistant rather than typing keywords. Total measured volume is still small (around 54 impressions over 90 days) and some appeared only once or twice, so the positions attached to them mean very little on their own. This remains a bet on a shift in how people search rather than a response to established volume.

What raised its weight is the shape of the intent, not the size of it. These queries reach page one — "need help pulling key dates and payment terms from like 500 pdfs automatically" sits around position 8 — and unlike the competitor-name queries the site also ranks for, the person asking has a problem and no vendor in mind yet. That is a reader who can be won. Someone typing "nanonets invoice ocr" cannot be, at any position.

Queries seen (treat as directional, not as scale):
  "what should i check before choosing an invoice ocr tool?"
  "which tools extract spreadsheet data from pdfs most accurately?"
  "how can i extract line-level charges from telecom invoices automatically?"
  "need help pulling key dates and payment terms from like 500 pdfs automatically, what software should i use"
  "what's the most affordable ai solution for converting invoices to spreadsheets?"

Pick ONE such question — ideally one of the above, or a close variant — and make it the title, phrased as a real question a person would type or say.

The structure that wins here is different from a normal SEO post: answer the question completely in the first two or three sentences, then earn the rest of the length by justifying that answer with specifics, edge cases, and worked examples. Someone who reads only the opening should already have the answer; someone who reads it all should understand why it's true.
Do not bury the answer, and do not open with "in this article we'll explore".`,
  },
];

/**
 * Expand the weighted templates into a flat rotation slate, spread so a weight
 * of 4 lands four times across the cycle rather than four times in a row.
 *
 * This was a round-robin — emit one slot per template per pass — which is fine
 * while the top weight is small, but degenerates at the tail: once the lighter
 * templates are spent, only the heaviest is left, and it emits back to back.
 * At weights 4/2/1 that put two "alternative" runs next to each other, which
 * is exactly the clustering the rotation exists to prevent.
 *
 * Even spacing instead: a template with weight w claims the w positions that
 * divide the cycle into w equal parts, so its runs sit N/w apart wherever it
 * appears in the list.
 *
 * The phase offset is load-bearing, not decoration. Phasing every template at
 * the same point in its interval makes the heaviest one hold both the first
 * and the last slot — which reads as spaced until the slate cycles and puts
 * those two back to back. Staggering the phase by list position pushes the
 * ends onto different templates. It also breaks the tie between the six
 * templates that share weight 2 and would otherwise compute identical
 * positions and sort arbitrarily.
 *
 * The half-of-total guard is a genuine precondition: above it, no arrangement
 * avoids repeats, so it fails loudly rather than quietly clustering. Below it,
 * spacing avoids adjacency for every weight set in use here — verified for the
 * current two — but that is an empirical claim rather than a proof, and the
 * dedup gate remains the real backstop against near-identical output.
 */
function buildRotationSlate(templates: ContentTemplate[]): ContentTemplate[] {
  const weights = templates.map((t) => Math.max(1, t.weight));
  const total = weights.reduce((a, b) => a + b, 0);

  const heaviest = Math.max(...weights);
  if (heaviest * 2 > total) {
    throw new Error(
      `Rotation weight ${heaviest} exceeds half of ${total}: no arrangement can ` +
        `avoid consecutive repeats. Lower it or add templates.`
    );
  }

  const placed: { at: number; t: ContentTemplate }[] = [];
  templates.forEach((t, index) => {
    const w = weights[index];
    const phase = index / templates.length;
    for (let k = 0; k < w; k++) {
      placed.push({ at: ((k + phase) * total) / w, t });
    }
  });

  return placed.sort((a, b) => a.at - b.at).map((p) => p.t);
}

const ROTATION_SLATE = buildRotationSlate(CONTENT_TEMPLATES);

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80)
    .replace(/-$/, "");
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runInformational();
    return NextResponse.json(result);
  } catch (err) {
    console.error("[SEO Content Cron] Error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";

    await sendTelegramMessage(
      `❌ <b>SEO Content Cron Failed</b>\n\nError: ${message}\n\nPlease check Vercel logs.`
    );

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Ping Google to re-crawl sitemap after publishing new content */
async function pingSitemap(): Promise<void> {
  try {
    await fetch(
      "https://www.google.com/ping?sitemap=https://www.invoicetodata.com/sitemap.xml",
      { signal: AbortSignal.timeout(10000) }
    );
    console.log("[SEO Content] Google sitemap ping sent");
  } catch {
    console.log("[SEO Content] Google sitemap ping failed (non-critical)");
  }
}

/**
 * Exported so the master cron can invoke this runner directly without an
 * HTTP round-trip. The standalone GET handler (above) is preserved for
 * manual triggering via curl.
 */
export async function runInformational() {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("Missing ANTHROPIC_API_KEY");
  if (!hasSupabaseConfig) throw new Error("Missing Supabase config");

  // Pick content type from the weighted rotation slate (see ROTATION_SLATE).
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
  );
  const template = ROTATION_SLATE[dayOfYear % ROTATION_SLATE.length];

  // Pull the FULL corpus WITH summaries — Layer 1 dedup gate uses these
  // compact snapshots instead of the old "title-only" check.
  //
  // This used to be .limit(30). At 120 posts that left 75% of the corpus
  // invisible to the dedup gate, and an audit traced 11 of 34 duplicate pairs
  // directly to that blind spot. A title plus a 60-80 word summary is ~110
  // tokens, so the whole corpus costs ~13k input tokens on Haiku — cheap
  // enough that blinding the gate to save tokens was never a good trade.
  const supabase = getSupabase();
  const { data: existingPosts } = await supabase
    .from("blogs")
    .select("title, slug, summary")
    .order("created_at", { ascending: false })
    .limit(2000);

  const existingSlugs = (existingPosts ?? []).map((p) => p.slug);
  const recentForPlanner: RecentPost[] = (existingPosts ?? []).map((p) => ({
    title: p.title,
    summary: p.summary,
  }));

  // ─── LAYER 3: DIVERSITY AXES ─────────────────────────────────────────
  // Random (persona × format × depth) combo per run. Layer 1 dedup
  // already prevents topical repetition; this varies the texture so even
  // adjacent topics don't read identically.
  const axes = pickDiversityAxes();

  // ─── LAYER 1: DEDUP GATE ─────────────────────────────────────────────
  // One Haiku call (~$0.008) proposes 3 distinct angles + scores each
  // against the corpus. If every candidate is too similar, we skip this
  // run entirely — saving the ~$0.05 Sonnet write that would have
  // produced a near-duplicate.
  let chosenAngle;
  try {
    const candidates = await proposeAndScoreCandidates({
      templatePrompt: template.prompt,
      templateType: template.type,
      recentPosts: recentForPlanner,
      count: 3,
      axes,
    });

    // ─── LAYER 1b: MECHANICAL VETO ─────────────────────────────────────
    // The planner scores its OWN proposals, and an audit of 120 live posts
    // found 23 duplicate pairs it had waved through while the older post was
    // right there in its context. So every candidate it likes gets re-checked
    // in code before we pay for the write.
    //
    // We walk all candidates (least-similar first) rather than testing only
    // the winner: if the top pick is a mechanical duplicate, candidates 2 and
    // 3 are already paid for, and using them is what keeps cadence up.
    const rejections: string[] = [];
    const ranked = [...candidates].sort(
      (a, b) => a.similarity_score - b.similarity_score
    );

    for (const candidate of ranked) {
      if (candidate.similarity_score >= DEDUP_THRESHOLD) {
        rejections.push(
          `• ${candidate.title}\n   planner: ${candidate.similarity_score} vs "${candidate.most_similar_title}"`
        );
        continue;
      }
      const verdict = mechanicalDupeCheck(candidate.title, recentForPlanner);
      if (verdict.isDupe) {
        rejections.push(
          `• ${candidate.title}\n   planner said ${candidate.similarity_score}, but mechanically: ${verdict.reason}\n   closest: "${verdict.closestTitle}"`
        );
        continue;
      }
      chosenAngle = candidate;
      break;
    }

    if (!chosenAngle) {
      await sendTelegramMessage(
        `⏭️ <b>SEO Content — Skipped</b>\n\n` +
          `Template: ${template.type}\n` +
          `Reason: no candidate cleared both the planner threshold (${DEDUP_THRESHOLD}) and the mechanical dedup check.\n\n` +
          `Rejected:\n${rejections.join("\n")}`
      );
      return { success: true, skipped: true, reason: "dedup", type: template.type };
    }

    if (rejections.length > 0) {
      console.log(
        `[SEO Content] Mechanical veto rejected ${rejections.length} candidate(s) before settling on "${chosenAngle.title}"`
      );
    }
  } catch (planErr) {
    // Planner failure isn't fatal — fall back to old behavior so we don't
    // silently stop publishing. Log loudly.
    console.error("[SEO Content] Planner failed, falling back to template-only:", planErr);
    chosenAngle = null;
  }

  // ─── LAYER 0: PRE-WRITE RESEARCH ─────────────────────────────────────
  // For templates that make claims about third parties, look up current facts
  // before writing. The Klippa alternatives post was generated thirteen months
  // after Klippa was acquired and three months after it was renamed, and said
  // neither — the writer can't know what it doesn't know, so we look it up.
  //
  // Costs one Sonnet call plus up to 5 searches, and only on the template
  // types that actually assert things about other companies.
  let research: Awaited<ReturnType<typeof researchCurrentFacts>> = {
    block: null,
    sources: [],
    note: "not applicable for this template",
  };
  if (chosenAngle && templateNeedsResearch(template.type)) {
    research = await researchCurrentFacts({
      subject: chosenAngle.title,
      angle: chosenAngle.summary,
    });
    console.log(
      research.block
        ? `[SEO Content] Research OK — ${research.sources.length} source(s)${research.note ? ` (${research.note})` : ""}`
        : `[SEO Content] Research unavailable: ${research.note ?? "unknown"} — writing without it`
    );
  }

  // Build internal links instruction
  const internalLinksInstruction = INTERNAL_LINKS.map(
    (l) => `- Link to ${l.url} with anchor text "${l.anchor}" at least once`
  ).join("\n");

  // Suggest internal links by TOPICAL RELEVANCE, not recency.
  //
  // This used to be `.slice(0, 5)` — the five newest posts. Every article
  // therefore linked to the same handful, so link equity pooled around
  // whatever was published last week and the other ~115 posts were orphaned.
  // That is the mechanism behind high-impression posts stalling at position
  // 60-85: real search demand, no internal links to build authority on.
  const linkTargets = pickRelevantLinkTargets(
    `${chosenAngle?.title ?? template.type} ${chosenAngle?.summary ?? ""}`,
    (existingPosts ?? []).map((p) => ({ title: p.title, slug: p.slug })),
    6
  );
  const recentLinksInstruction = linkTargets
    .map((p) => `- You may link to https://invoicetodata.com/blog/${p.slug} (titled: "${p.title}")`)
    .join("\n");

  // If the planner picked an angle, lock the writer to it. Otherwise fall
  // back to the loose template brief (planner failure path).
  const angleBlock = chosenAngle
    ? formatLockedAngle(chosenAngle)
    : `TEMPLATE BRIEF:\n${template.prompt}`;

  // The writer only needs the nearest neighbours to steer away from; the full
  // corpus goes to the planner instead, where it actually gates the decision.
  const existingTitlesForAvoid = recentForPlanner
    .slice(0, AVOID_LIST_SIZE)
    .map((p) => `"${p.title}"`)
    .join(", ");

  const fullPrompt = `You are an expert SEO content writer for InvoiceToData (https://invoicetodata.com), a SaaS tool that converts invoices into structured data using AI OCR.

${angleBlock}
${research.block ? `\n${research.block}\n` : ""}
${formatDiversityAxes(axes)}

IMPORTANT RULES:
- Article must be ${axes.depth.minWords}-${axes.depth.maxWords} words
- Write in English
- Use proper Markdown formatting with ## and ### headings
- Do NOT retread the same ground as these existing articles: ${existingTitlesForAvoid}
- Include relevant keywords naturally throughout: invoice OCR, invoice data extraction, invoice parser, PDF to Excel, invoice scanning, automated invoice processing
- Write for humans first, search engines second — be genuinely helpful

INTERNAL LINKING (very important for SEO):
${internalLinksInstruction}
${recentLinksInstruction}

STRUCTURE REQUIREMENTS:
- Open with a **bolded 2-3 sentence direct answer** to the question implied by the title, BEFORE any heading. No preamble, no "in this article we will". Just answer it. Someone who reads only these sentences should get the real answer.
- Then ## Introduction (engaging hook with statistics or a pain point)
- Use ## for main sections, ### for subsections (follow the LOCKED ANGLE outline above when present)
- Include at least one comparison table (markdown table) if relevant
- Include a ## Frequently Asked Questions section with 3-5 Q&As
- End with a ## Conclusion and clear CTA linking to https://invoicetodata.com
- Add "Related:" section at the bottom linking to 2-3 of our existing blog posts

WHY THE OPENING ANSWER MATTERS:
Search Console shows real traffic arriving on conversational, question-shaped
queries ("what should i check before choosing an invoice ocr tool?", "which
tools extract spreadsheet data from pdfs most accurately?") — the kind of
query answered by an AI summary that quotes a source. To be the quoted
source, the answer has to be self-contained and near the top. Write that
opening block so it stands alone if lifted out of the page.

E-E-A-T COMPLIANCE:
- Include specific numbers, statistics, or data points where possible
- Reference real tools and real use cases
- Write from practical experience perspective
- Be balanced and honest in comparisons
- NEVER invent a statistic to make a point land. If you don't have a real
  figure, describe the mechanism instead of quantifying it. Two articles on
  this blog already claim the same case study produced "95%" and "85%"
  efficiency gains — fabricated numbers that contradict each other are worse
  than no numbers, because a reader who spots one stops trusting all of them.

Do NOT start content with the title (I'll use it separately).

FORMAT YOUR RESPONSE EXACTLY LIKE THIS:
TITLE: [Your SEO-optimized title here]
SUMMARY: [60-80 word summary that captures the unique angle and key takeaway — used by future dedup checks, so be specific about what makes THIS post different]
META: [Meta description, max 155 characters, include primary keyword and a compelling reason to click]
KEYWORDS: [keyword1, keyword2, keyword3, keyword4, keyword5]
---
[Article content in Markdown starting with ## Introduction]`;

  const client = getAnthropic();
  const message = await client.messages.create({
    model: SEO_MODEL,
    max_tokens: 16000,
    output_config: { effort: "medium" },
    messages: [{ role: "user", content: fullPrompt }],
  });
  const response = extractText(message);

  // Parse the response
  const titleMatch = response.match(/TITLE:\s*(.+)/);
  const summaryMatch = response.match(/SUMMARY:\s*(.+)/);
  const metaMatch = response.match(/META:\s*(.+)/);
  const keywordsMatch = response.match(/KEYWORDS:\s*(.+)/);
  const contentStart = response.indexOf("---");

  if (!titleMatch || contentStart === -1) {
    throw new Error("Failed to parse Claude response — unexpected format");
  }

  const title = titleMatch[1].trim();
  // Fall back to chosenAngle.summary if Sonnet skipped the SUMMARY field —
  // we never want to insert a row with NULL summary now that the dedup gate
  // depends on it for future runs.
  const summary =
    summaryMatch?.[1]?.trim() || chosenAngle?.summary || `${title}.`;
  const metaDescription = metaMatch?.[1]?.trim().slice(0, 160) ?? "";
  const keywords = keywordsMatch?.[1]?.trim() ?? "";
  const content = response.slice(contentStart + 3).trim();

  // ─── LAYER 2: CRITIC GATE ────────────────────────────────────────────
  // Catch generic / weak content BEFORE publishing. We don't auto-retry
  // (that costs another full Sonnet call); we surface to Telegram so the
  // user can decide.
  const verdict = await criticReview({
    title,
    content,
    angleSummary: chosenAngle?.summary,
    client,
  });
  if (!verdict.pass) {
    await sendTelegramMessage(
      `🚫 <b>SEO Content — Critic rejected draft</b>\n\n` +
        `📝 <b>${title}</b>\n` +
        `Type: ${template.type}\n\n` +
        formatCriticVerdict(verdict)
    );
    return {
      success: true,
      skipped: true,
      reason: `critic:${verdict.issues[0] ?? "quality"}`,
      type: template.type,
    };
  }

  const slug = slugify(title);

  // A slug collision means the writer produced a title we already published.
  // This used to append a date suffix and publish anyway, which is how
  // "Invoice OCR Pricing Comparison 2026: Finding the Best Value for Your
  // Business" ended up live twice (2026-04-12 and again as
  // ...-2026-04-19). Both URLs got indexed and now split the same keyword
  // between them in Search Console. Detecting the collision and working
  // around it was strictly worse than stopping.
  if (existingSlugs.includes(slug)) {
    await sendTelegramMessage(
      `🚫 <b>SEO Content — Duplicate title blocked</b>\n\n` +
        `📝 <b>${title}</b>\n` +
        `Type: ${template.type}\n\n` +
        `The writer produced a title that already exists at /blog/${slug}. ` +
        `Nothing was published — publishing it under a date-suffixed slug ` +
        `would cannibalise the original.`
    );
    return {
      success: true,
      skipped: true,
      reason: "duplicate-slug",
      type: template.type,
    };
  }

  // Same check on the title itself, since a near-identical title can differ
  // by punctuation alone and still slugify differently.
  const titleNorm = normalizeTitle(title);
  const titleClash = (existingPosts ?? []).find(
    (p) => normalizeTitle(p.title) === titleNorm
  );
  if (titleClash) {
    await sendTelegramMessage(
      `🚫 <b>SEO Content — Duplicate title blocked</b>\n\n` +
        `📝 <b>${title}</b>\n` +
        `Type: ${template.type}\n\n` +
        `Matches the existing post at /blog/${titleClash.slug}. Nothing published.`
    );
    return {
      success: true,
      skipped: true,
      reason: "duplicate-title",
      type: template.type,
    };
  }

  // Insert new blog post
  const { error } = await supabase
    .from("blogs")
    .insert({
      title,
      slug,
      meta_description: metaDescription,
      keywords,
      content,
      summary,
    })
    .select()
    .single();

  if (error) throw new Error(`Supabase insert failed: ${error.message}`);

  // Ping Google to re-crawl sitemap
  await pingSitemap();

  // Notify via Telegram with axis tags + critic scores so the user can
  // spot patterns over time.
  await notifyTelegram(title, slug, template.type, keywords, axes, verdict, research);

  return { success: true, slug, type: template.type };
}

async function notifyTelegram(
  title: string,
  slug: string,
  type: string,
  keywords: string,
  axes: ReturnType<typeof pickDiversityAxes>,
  verdict: Awaited<ReturnType<typeof criticReview>>,
  research: Awaited<ReturnType<typeof researchCurrentFacts>>
) {
  const url = `https://invoicetodata.com/blog/${slug}`;

  // Surface whether competitor claims were checked against live sources.
  // A post written without research isn't blocked, but it's worth knowing
  // which posts carry that risk — that's how the stale-Klippa problem went
  // unnoticed for months.
  const researchLine = research.block
    ? `🔍 Researched: ${research.sources.length} live source(s) consulted${research.note ? ` — ${research.note}` : ""}`
    : templateNeedsResearch(type)
      ? `⚠️ Research FAILED (${research.note ?? "unknown"}) — competitor facts came from model knowledge, spot-check them`
      : `➖ Research not applicable for this template`;

  const msg = `✅ <b>New SEO Blog Post Published!</b>

📝 <b>${title}</b>
📂 Type: ${type}
🎭 Persona: ${axes.persona.label} • Format: ${axes.format.label} • Depth: ${axes.depth.label}
🔑 Keywords: ${keywords}
🔗 <a href="${url}">View Post</a>

${researchLine}
✅ Critic passed (numbers ${verdict.scores.specificNumbers}, entities ${verdict.scores.namedEntities}, faq ${verdict.scores.faqQuality}, fit ${verdict.scores.structuralFit})
✅ Google sitemap ping sent`;

  await sendTelegramMessage(msg);
}
