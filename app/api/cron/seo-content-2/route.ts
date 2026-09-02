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

/** How many corpus titles to name in the writer prompt as "don't retread". */
const AVOID_LIST_SIZE = 25;

/**
 * Vercel Cron Job — runs daily at 12:00 PM UTC (7:00 PM VN) when invoked
 * standalone. Also dispatched by /api/cron/master on buyer-intent days.
 * Focuses on HIGH-CONVERSION content: buyer-intent keywords, pricing,
 * ROI, case studies.
 */

/** www is canonical — see the note in seo-content/route.ts. The bare host 308s. */
const SITE_URL = "https://www.invoicetodata.com";

/** Ordered by measured clicks, same rationale as seo-content/route.ts. */
const INTERNAL_LINKS = [
  { url: `${SITE_URL}/tools/bank-statement-to-excel`, anchor: "bank statement to Excel converter" },
  { url: `${SITE_URL}/tools/pdf-to-excel`, anchor: "PDF to Excel converter" },
  { url: SITE_URL, anchor: "InvoiceToData" },
  { url: `${SITE_URL}/pricing`, anchor: "pricing" },
  { url: `${SITE_URL}/tools/pdf-to-gsheet`, anchor: "PDF to Google Sheets" },
  { url: `${SITE_URL}/blog`, anchor: "our blog" },
];

/**
 * HIGH-CONVERSION content templates — targets buyer-intent keywords.
 *
 * `weight` mirrors the informational side: slots are allocated from measured
 * Search Console demand, not evenly. The alternative/competitor cluster is
 * the closest thing the site has to page one (position 10.8 on "klippa
 * alternative"), so buyer-intent framings of it get the most room. Uniform
 * rotation would treat a 25-impression theme as equal to a 246-impression
 * one. See the note in seo-content/route.ts for the full theme breakdown.
 *
 * Reweighted 2026-08-29 alongside the informational side, but far less: the
 * intent problem found there does not apply here. These templates target what
 * a buyer types — "invoice OCR pricing comparison", "cheapest invoice OCR" —
 * not a vendor's brand name, so they are not stranded on navigational queries
 * the way "InvoiceToData vs X" was. pricing-comparison in particular is doing
 * what it should: 179 impressions at position 17.9, which is page two of a
 * commercial query and a genuine climb from there.
 *
 * The one change is `llm-buying-decision` 2 -> 3, for the same reason its
 * informational counterpart went up — that cluster is the only one on the
 * site turning impressions into clicks.
 */
type ContentTemplate = { type: string; weight: number; prompt: string };

const CONTENT_TEMPLATES: ContentTemplate[] = [
  {
    type: "buyer-guide",
    weight: 3,
    prompt: `Write a comprehensive buyer's guide for someone ready to purchase invoice processing software.
Target keywords: "best invoice OCR software", "invoice OCR pricing", "buy invoice automation tool".
Include a comparison table of 5+ tools with pricing, a "Who should buy what" section, and position InvoiceToData as the best value option.
Include a clear pricing/CTA section mentioning InvoiceToData's free tier and paid plans.`,
  },
  {
    type: "roi-analysis",
    weight: 2,
    prompt: `Write a detailed ROI analysis article about implementing invoice automation.
Target keywords: "invoice automation ROI", "cost of manual invoice processing", "invoice OCR cost savings".
Include real calculations: time saved per invoice, cost per invoice manually vs automated, annual savings for different business sizes.
Use a table showing ROI for small (100 invoices/mo), medium (500), and large (2000+) businesses.
End with CTA: "Calculate your savings — try InvoiceToData free".`,
  },
  {
    type: "vs-manual",
    weight: 1,
    prompt: `Write an article comparing manual invoice processing vs automated solutions in detail.
Target keywords: "manual vs automated invoice processing", "why automate invoices", "invoice automation benefits".
Include real-world time comparisons, error rates, cost analysis.
Use before/after scenarios with specific numbers.
Position InvoiceToData as the easy-to-adopt solution with free tier.`,
  },
  {
    type: "migration-guide",
    weight: 1,
    prompt: `Write a practical migration guide for businesses switching from manual invoice processing to automation.
Target keywords: "switch to invoice automation", "implement invoice OCR", "invoice automation setup guide".
Include: planning checklist, tool selection criteria, implementation timeline, common pitfalls.
Recommend InvoiceToData for businesses that want to start quickly with zero setup.`,
  },
  {
    type: "pricing-comparison",
    weight: 3,
    prompt: `Write a comprehensive pricing comparison of invoice OCR tools in 2026.
Target keywords: "invoice OCR pricing comparison", "cheapest invoice OCR", "invoice automation cost".
Compare pricing of: ABBYY, Nanonets, Klippa, Rossum, Docsumo, Mindee, Veryfi, and InvoiceToData.
Include a pricing table, free tier comparison, cost per page, and value analysis.
Highlight that InvoiceToData offers a free tier and competitive pricing.`,
  },
  {
    type: "worked-example",
    weight: 1,
    prompt: `Write a worked cost example for a specific, clearly-hypothetical business profile.

IMPORTANT — this template used to ask for a "realistic case study" with invented result metrics, and that produced real damage: two articles on this blog now describe the same scenario as delivering "95%" and "85%" efficiency gains. Contradictory invented numbers are worse than no numbers, because a reader who notices stops believing anything else on the page.

So: no fake customers, no fake company names, no invented outcome percentages, no fabricated quotes.

Instead, build a transparent model the reader can re-run with their own inputs:
- State the profile plainly as an example, e.g. "a bookkeeping practice handling 400 invoices a month across 12 clients"
- Show the arithmetic step by step: volume x minutes per document = hours; hours x hourly cost = spend
- State every assumption in a table and label it as an assumption
- Compare against InvoiceToData's real published pricing at ${SITE_URL}/pricing
- Show the break-even point and be honest about when automation does NOT pay off (very low volume, highly irregular documents, cases needing line-level human review anyway)

Target keywords: "invoice automation ROI", "cost of manual invoice processing", "invoice processing cost per invoice".
The reader should finish able to compute their own number, not impressed by ours.`,
  },
  {
    type: "integration-guide",
    weight: 1,
    prompt: `Write a detailed guide about integrating invoice OCR with popular business tools.
Target keywords: "invoice OCR integration", "connect invoice data to accounting software", "invoice automation workflow".
Cover integrations with: QuickBooks, Xero, Google Sheets, Excel, Zapier.
Show how InvoiceToData fits into existing workflows and saves time.`,
  },

  // ─── Buyer-intent templates for the untapped verticals ────────────────
  // Same rationale as the informational side: the templates above are all
  // invoice-OCR framings, and the corpus had run out of distinct angles.
  // These target commercial queries the site already receives.

  {
    type: "llm-buying-decision",
    weight: 3,
    prompt: `Write for someone deciding between "just use an AI assistant" and paying for a purpose-built tool.

This is a real, current buying question and the site ranks unusually well for the neighbouring queries. Across the whole cluster, 89 impressions produced 4 clicks — about 4.5%, against a site-wide average nearer 1%, and a third of every click the site received in the period. Read that as a strong signal of intent, not as a precise rate: it rests on single-digit click counts, and the individual query positions behind it move on a handful of impressions. Search Console also shows people arriving on "what's the most affordable ai solution for converting invoices to spreadsheets?" and "is there a tool that can automatically extract data from invoices and populate excel forms using ai?".

Make the honest case on both sides. An AI assistant subscription is excellent for occasional one-off documents and costs nothing extra if the reader already pays for it. It falls down on repeated work: no batch processing, per-file manual effort, output shape that drifts between runs, no direct .xlsx export, and no audit trail.

Be specific about the crossover point — roughly how many documents a month before a dedicated tool wins, and why. InvoiceToData runs on Claude, so the honest positioning is "the same model with the workflow a repeated task requires", never "AI assistants can't do this". A reader who leaves deciding the assistant is enough for their volume has still been served well, and will come back when volume changes.
Target keywords: "claude pdf to excel", "chatgpt vs invoice ocr tool", "ai invoice extraction cost".`,
  },
  {
    type: "bank-buying-guide",
    weight: 2,
    prompt: `Write for someone evaluating how to get bank statement data into their accounting system at a specific scale.

Search Console shows commercial intent here on pages 3-6, with no strong page to serve it: "bank statement to excel software" (position 75), "bank statement converter to excel" (position 57), "software to convert bank statements into excel" (position 49), "ai bank statement converter" (position 24), "bank statement converter ai free" (position 24).

Pick ONE scale and write for it properly: a solo bookkeeper reconciling a handful of accounts, a practice handling twenty-plus clients across different banks, or a finance team closing monthly across multiple entities and currencies.

Cover honestly: when the bank's own CSV export is all you need and no tool is warranted, what actually breaks at scale (mixed formats across banks, password-protected PDFs, multi-account statements, closed accounts with PDF-only history), what to look for in a converter, and how the output has to land for reconciliation to be quick rather than merely possible.
Reference the real published pricing at ${SITE_URL}/pricing and link to /tools/bank-statement-to-excel.`,
  },
];

/** Evenly-spaced weighted slate — see buildRotationSlate in seo-content/route.ts. */
function buildRotationSlate(templates: ContentTemplate[]): ContentTemplate[] {
  const weights = templates.map((t) => Math.max(1, t.weight));
  const total = weights.reduce((a, b) => a + b, 0);

  const heaviest = Math.max(...weights);
  if (heaviest * 2 > total) {
    throw new Error(
      `Rotation weight ${heaviest} exceeds half of ${total}: even spacing cannot ` +
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

async function pingSitemap(): Promise<void> {
  try {
    await fetch(
      `https://www.google.com/ping?sitemap=${SITE_URL}/sitemap.xml`,
      { signal: AbortSignal.timeout(10000) }
    );
  } catch { /* non-critical */ }
}

export type RunnerResult =
  | { success: true; skipped?: false; slug: string; type: string }
  | { success: true; skipped: true; reason: string; type: string };

/**
 * Exported so the master cron can invoke this runner directly. Returns a
 * plain result object so the master can compose it with other runners.
 */
export async function runBuyerIntent(): Promise<RunnerResult> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("Missing ANTHROPIC_API_KEY");
  if (!hasSupabaseConfig) throw new Error("Missing Supabase config");

  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
  );
  const template = ROTATION_SLATE[dayOfYear % ROTATION_SLATE.length];

  // Full corpus, not a 30-post window — see the note in seo-content/route.ts:
  // the window left 75% of posts invisible to the dedup gate.
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
  // Random (persona × format × depth) combo per run. Layer 1 dedup gate
  // already handles topical repetition; this just ensures structural and
  // tonal variety so even adjacent topics feel distinct.
  const axes = pickDiversityAxes();

  // ─── LAYER 1: DEDUP GATE ─────────────────────────────────────────────
  let chosenAngle;
  try {
    const candidates = await proposeAndScoreCandidates({
      templatePrompt: template.prompt,
      templateType: template.type,
      recentPosts: recentForPlanner,
      count: 3,
      axes,
    });
    // ─── LAYER 1b: MECHANICAL VETO ───────────────────────────────────────
    // Independent re-check of the planner's self-scored similarity. Walks all
    // candidates least-similar-first so a vetoed top pick falls through to
    // candidates 2 and 3 instead of wasting the run.
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
        `⏭️ <b>SEO Content-2 — Skipped</b>\n\n` +
          `Template: ${template.type} (buyer-intent)\n` +
          `Reason: no candidate cleared both the planner threshold (${DEDUP_THRESHOLD}) and the mechanical dedup check.\n\n` +
          `Rejected:\n${rejections.join("\n")}`
      );
      return {
        success: true,
        skipped: true,
        reason: "dedup",
        type: template.type,
      };
    }

    if (rejections.length > 0) {
      console.log(
        `[SEO Content-2] Mechanical veto rejected ${rejections.length} candidate(s) before settling on "${chosenAngle.title}"`
      );
    }
  } catch (planErr) {
    console.error("[SEO Content-2] Planner failed, falling back:", planErr);
    chosenAngle = null;
  }

  // ─── LAYER 0: PRE-WRITE RESEARCH ─────────────────────────────────────
  // Buyer-intent templates quote competitor pricing, which is the fact class
  // that goes stale fastest — and a wrong price in a comparison table is both
  // a credibility problem and unfair to the competitor. Look it up before
  // writing; see the note in lib/seoContent.ts for why prompting can't fix it.
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
        ? `[SEO Content-2] Research OK — ${research.sources.length} source(s)${research.note ? ` (${research.note})` : ""}`
        : `[SEO Content-2] Research unavailable: ${research.note ?? "unknown"} — writing without it`
    );
  }

  const internalLinksInstruction = INTERNAL_LINKS.map(
    (l) => `- Link to ${l.url} with anchor text "${l.anchor}" at least once`
  ).join("\n");

  // Link targets by topical relevance, not recency — the old `.slice(0, 5)`
  // pooled all internal links on the newest few posts and orphaned the rest.
  const linkTargets = pickRelevantLinkTargets(
    `${chosenAngle?.title ?? template.type} ${chosenAngle?.summary ?? ""}`,
    (existingPosts ?? []).map((p) => ({ title: p.title, slug: p.slug })),
    6
  );
  const recentLinksInstruction = linkTargets
    .map((p) => `- You may link to ${SITE_URL}/blog/${p.slug} (titled: "${p.title}")`)
    .join("\n");

  const angleBlock = chosenAngle
    ? formatLockedAngle(chosenAngle)
    : `TEMPLATE BRIEF:\n${template.prompt}`;

  const existingTitlesForAvoid = recentForPlanner
    .slice(0, AVOID_LIST_SIZE)
    .map((p) => `"${p.title}"`)
    .join(", ");

  const fullPrompt = `You are an expert SEO content writer for InvoiceToData (${SITE_URL}), a SaaS tool that converts invoices into structured data using AI OCR.

${angleBlock}
${research.block ? `
${research.block}
` : ""}

${formatDiversityAxes(axes)}

IMPORTANT — THIS IS CONVERSION-FOCUSED CONTENT:
- Article must be ${axes.depth.minWords}-${axes.depth.maxWords} words
- Write in English
- Target BUYER-INTENT keywords (people ready to purchase/try a solution)
- Include pricing mentions, ROI data, and clear CTAs throughout
- Every major section should end with a soft CTA like "Try InvoiceToData free →" or "See pricing →"
- Include a compelling "## Why Choose InvoiceToData" section near the end
- Do NOT retread the same ground as: ${existingTitlesForAvoid}

INTERNAL LINKING:
${internalLinksInstruction}
${recentLinksInstruction}

CONVERSION ELEMENTS TO INCLUDE:
- At least 2 CTAs linking to ${SITE_URL}/tools/pdf-to-excel or ${SITE_URL}/pricing
- A comparison table if relevant
- Concrete, defensible numbers — published vendor pricing, arithmetic the
  reader can redo themselves (e.g. "200 invoices x 4 minutes = 13 hours"),
  or clearly-labelled worked examples
- A ## Frequently Asked Questions section with 3-5 buyer-focused Q&As

CLAIMS DISCIPLINE (do not skip this):
- Do NOT invent customer counts, adoption claims, or vague social proof.
  Phrases like "thousands of businesses" or "used by accounting firms
  worldwide" are unverifiable and we do not have the numbers to back them.
- Do NOT fabricate a statistic to make a point land. If there's no real
  figure, explain the mechanism instead. Two posts on this blog already
  describe the same case study as "95%" and "85%" efficiency gains —
  contradictory invented numbers cost more trust than they buy attention.
- Our real, stated facts: free first conversion without signup, free credits
  on account creation, and the published pricing on ${SITE_URL}/pricing.
  Sell with those.

STRUCTURE:
- Open with a **bolded 2-3 sentence direct answer** to the question implied by the title, BEFORE any heading. No preamble. Someone who reads only these sentences should get the real answer — this is what an AI summary quotes.
- Then ## Introduction (hook with a business pain point and cost implication)
- Use ## for main sections, ### for subsections (follow the LOCKED ANGLE outline above when present)
- Include a ## Conclusion with strong CTA
- Add "Related:" section linking to 2-3 existing blog posts

FORMAT YOUR RESPONSE EXACTLY LIKE THIS:
TITLE: [Buyer-intent SEO title]
SUMMARY: [60-80 word summary that captures the unique angle and key takeaway — used by future dedup checks, so be specific about what makes THIS post different]
META: [Meta description, max 155 chars, include primary keyword + reason to click]
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

  const titleMatch = response.match(/TITLE:\s*(.+)/);
  const summaryMatch = response.match(/SUMMARY:\s*(.+)/);
  const metaMatch = response.match(/META:\s*(.+)/);
  const keywordsMatch = response.match(/KEYWORDS:\s*(.+)/);
  const contentStart = response.indexOf("---");

  if (!titleMatch || contentStart === -1) {
    throw new Error("Failed to parse Claude response");
  }

  const title = titleMatch[1].trim();
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
      `🚫 <b>SEO Content-2 — Critic rejected draft</b>\n\n` +
        `📝 <b>${title}</b>\n` +
        `Type: ${template.type} (buyer-intent)\n\n` +
        formatCriticVerdict(verdict)
    );
    return {
      success: true,
      skipped: true,
      reason: `critic:${verdict.issues[0] ?? "quality"}`,
      type: template.type,
    };
  }

  // Collision = we already published this title. Stop, don't date-suffix and
  // publish anyway — that path is what put two copies of "Invoice OCR Pricing
  // Comparison 2026" into the index, splitting one keyword across both.
  const slug = slugify(title);
  if (existingSlugs.includes(slug)) {
    await sendTelegramMessage(
      `🚫 <b>SEO Content-2 — Duplicate title blocked</b>\n\n` +
        `📝 <b>${title}</b>\n` +
        `Type: ${template.type} (buyer-intent)\n\n` +
        `A post already lives at /blog/${slug}. Nothing published.`
    );
    return {
      success: true,
      skipped: true,
      reason: "duplicate-slug",
      type: template.type,
    };
  }

  const titleNorm = normalizeTitle(title);
  const titleClash = (existingPosts ?? []).find(
    (p) => normalizeTitle(p.title) === titleNorm
  );
  if (titleClash) {
    await sendTelegramMessage(
      `🚫 <b>SEO Content-2 — Duplicate title blocked</b>\n\n` +
        `📝 <b>${title}</b>\n` +
        `Type: ${template.type} (buyer-intent)\n\n` +
        `Matches the existing post at /blog/${titleClash.slug}. Nothing published.`
    );
    return {
      success: true,
      skipped: true,
      reason: "duplicate-title",
      type: template.type,
    };
  }

  const { error } = await supabase
    .from("blogs")
    .insert({ title, slug, meta_description: metaDescription, keywords, content, summary })
    .select()
    .single();

  if (error) throw new Error(`Supabase insert failed: ${error.message}`);

  await pingSitemap();

  await sendTelegramMessage(
    `✅ <b>Conversion Blog Post Published!</b>\n\n` +
      `📝 <b>${title}</b>\n` +
      `📂 Type: ${template.type} (buyer-intent)\n` +
      `🎭 Persona: ${axes.persona.label} • Format: ${axes.format.label} • Depth: ${axes.depth.label}\n` +
      `🔑 Keywords: ${keywords}\n` +
      `🔗 <a href="${SITE_URL}/blog/${slug}">View Post</a>\n\n` +
      `💰 Conversion-optimized with CTAs and pricing mentions\n` +
      `✅ Critic passed (specifics ${verdict.scores.specificNumbers}, named entities ${verdict.scores.namedEntities})\n` +
      `✅ Google sitemap ping sent`
  );

  return { success: true, slug, type: template.type };
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runBuyerIntent();
    return NextResponse.json(result);
  } catch (err) {
    console.error("[SEO Content-2 Cron] Error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    await sendTelegramMessage(`❌ <b>SEO Content-2 Cron Failed</b>\n\nError: ${message}`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
