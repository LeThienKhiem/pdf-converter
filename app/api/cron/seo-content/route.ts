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

// Internal pages to link to in blog content
const INTERNAL_LINKS = [
  { url: "https://invoicetodata.com", anchor: "InvoiceToData" },
  { url: "https://invoicetodata.com/tools/pdf-to-excel", anchor: "PDF to Excel converter" },
  { url: "https://invoicetodata.com/tools/pdf-to-gsheet", anchor: "PDF to Google Sheets" },
  { url: "https://invoicetodata.com/blog", anchor: "our blog" },
];

// SEO content calendar — rotates based on day of year
const CONTENT_TEMPLATES = [
  {
    type: "comparison",
    prompt: `Write a detailed comparison article for the invoice OCR software market.
Pick ONE specific competitor to compare against InvoiceToData. Choose from: Klippa, Nanonets, Rossum, Docsumo, Mindee, ABBYY, Veryfi, Tabula, Amazon Textract.
DO NOT pick the same competitor as a previous article.
The article should compare features, pricing, ease of use, accuracy, and integrations.
Position InvoiceToData favorably but fairly.`,
  },
  {
    type: "how-to",
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
  // Each template below is anchored to queries the site already receives, so
  // these are documented demand rather than guesses.

  {
    type: "llm-workflow",
    prompt: `Write about using a general-purpose AI assistant to get data out of documents and into a spreadsheet.

This is the highest-value topic on the blog and the least covered. Search Console shows these queries already ranking with click-through rates around 13-14%, roughly thirty times the site average, because almost nobody is writing for them:
  "claude pdf to excel" (position 5), "claude ai pdf to excel" (position 4),
  "can claude convert pdf to excel" (position 10), "claude convert pdf to excel" (position 8),
  "gemini ocr" (position 51)

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
    prompt: `Write a practical guide to getting transaction data out of a specific bank and into a spreadsheet.

Search Console shows a whole cluster of this intent ranking on pages 3-6, meaning real demand and no strong page to serve it:
  "how to download chase statements as csv" (position 41), "chase export transactions to excel" (position 35),
  "how to download hsbc statements in csv" (position 49), "amex download statement as csv" (position 46),
  "how to download citibank statement in excel" (position 17), "how to download barclays statements in csv format" (position 77),
  "convert bank of america statement to excel" (position 82), "pnc bank statement generator" (position 32)

Pick ONE bank and cover it properly: Chase, Bank of America, Wells Fargo, Citi, Capital One, Amex, HSBC, Barclays, PNC, TD Bank, US Bank, Discover.

Cover: which export formats that bank actually offers, when the native CSV export is enough (say so plainly — don't push a conversion the reader doesn't need), what to do when only PDF statements exist (older records, closed accounts, international branches), how to handle password-protected downloads, and how to get the result into QuickBooks or Xero.

Only state things that are generally true and stable. Do NOT invent exact menu paths, button labels, or screen names — online banking UIs change constantly and a wrong instruction is worse than a general one. Link to the matching page at /tools/bank/{bank-slug} where one exists.`,
  },
  {
    type: "document-type",
    prompt: `Write about extracting data from a document type that is NOT an invoice.

The blog is saturated with invoice content while these adjacent queries sit unserved:
  "remittance advice ocr" (position 80), "quotation ocr" (position 70),
  "extract income statement of dva to excel" (position 79), "rent invoice data extractor" (position 60),
  "reduce manual acord form data entry" (position 78), "multi-page invoice ocr" (position 20)

Pick ONE document type and treat it as its own subject with its own quirks: receipts and expense reports, purchase orders, payslips and payroll registers, remittance advice, quotes and estimates, freight and BOL documents, rent rolls and lease schedules, insurance forms, tax forms, utility bills, or medical billing statements.

Cover what fields matter for that document, the structural quirks that make it harder than an invoice (multi-column layouts, repeating groups, totals that must reconcile, per-line tax), what to check in the output before trusting it, and where the data usually needs to land.
Mention invoices only where the comparison genuinely helps. This article should be about the other document.`,
  },
  {
    type: "integration",
    prompt: `Write a guide to moving extracted document data into one specific downstream system.

Search Console shows this intent arriving with no dedicated page to receive it:
  "integrate ocr data with quickbooks online automatically" (position 81),
  "dynamically pull invoices from xero to google sheets" (position 60),
  "xero automate data extraction" (position 54), "quickbooks ocr" (position 45),
  "convert chase bank statement for quickbooks" (position 86), "bai to excel converter" (position 77)

Pick ONE destination: QuickBooks Online, Xero, Sage, Wave, NetSuite, FreshBooks, Google Sheets as a live control layer, Excel Power Query, or a plain CSV import into a custom system.

Cover the actual mechanics: what column layout that system expects, how dates and amounts must be formatted, how to handle multi-currency, what its importer rejects and why, how to reconcile against existing records, and what to do about duplicates on a re-import.
Be concrete about field mapping — a table showing source field to destination field is the most useful thing this article can contain.`,
  },
  {
    type: "direct-answer",
    prompt: `Write a focused article that answers ONE specific question completely and immediately.

Search Console shows conversational, full-sentence queries arriving and already ranking on page one, which means an AI summary or assistant is surfacing this content and quoting from it:
  "what should i check before choosing an invoice ocr tool?" (position 10),
  "which tools extract spreadsheet data from pdfs most accurately?" (position 14),
  "how can i extract line-level charges from telecom invoices automatically?" (position 8),
  "need help pulling key dates and payment terms from like 500 pdfs automatically, what software should i use" (position 8),
  "how accurate is automated invoice extraction" (position 22),
  "what's the most affordable ai solution for converting invoices to spreadsheets?" (position 57)

Pick ONE such question — ideally one of the above, or a close variant — and make it the title, phrased as a real question a person would type or say.

The structure that wins here is different from a normal SEO post: answer the question completely in the first two or three sentences, then earn the rest of the length by justifying that answer with specifics, edge cases, and worked examples. Someone who reads only the opening should already have the answer; someone who reads it all should understand why it's true.
Do not bury the answer, and do not open with "in this article we'll explore".`,
  },
];

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

  // Pick content type based on day of year (rotates through all templates)
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
  );
  const template = CONTENT_TEMPLATES[dayOfYear % CONTENT_TEMPLATES.length];

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
  await notifyTelegram(title, slug, template.type, keywords, axes, verdict);

  return { success: true, slug, type: template.type };
}

async function notifyTelegram(
  title: string,
  slug: string,
  type: string,
  keywords: string,
  axes: ReturnType<typeof pickDiversityAxes>,
  verdict: Awaited<ReturnType<typeof criticReview>>
) {
  const url = `https://invoicetodata.com/blog/${slug}`;
  const msg = `✅ <b>New SEO Blog Post Published!</b>

📝 <b>${title}</b>
📂 Type: ${type}
🎭 Persona: ${axes.persona.label} • Format: ${axes.format.label} • Depth: ${axes.depth.label}
🔑 Keywords: ${keywords}
🔗 <a href="${url}">View Post</a>

✅ Critic passed (numbers ${verdict.scores.specificNumbers}, entities ${verdict.scores.namedEntities}, faq ${verdict.scores.faqQuality}, fit ${verdict.scores.structuralFit})
✅ Google sitemap ping sent`;

  await sendTelegramMessage(msg);
}
