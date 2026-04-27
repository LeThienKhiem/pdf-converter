import { NextResponse } from "next/server";
import { SEO_MODEL, extractText, getAnthropic } from "@/lib/anthropic";
import { getSupabase, hasSupabaseConfig } from "@/lib/supabase";
import { sendTelegramMessage } from "@/lib/telegram";

/**
 * Vercel Cron Job — runs daily at 12:00 PM UTC (7:00 PM VN)
 * Second daily content cron — focuses on HIGH-CONVERSION content:
 * buyer-intent keywords, pricing comparisons, ROI calculators, case studies.
 * This complements the morning cron which focuses on informational content.
 */

const SITE_URL = "https://invoicetodata.com";

const INTERNAL_LINKS = [
  { url: SITE_URL, anchor: "InvoiceToData" },
  { url: `${SITE_URL}/tools/pdf-to-excel`, anchor: "PDF to Excel converter" },
  { url: `${SITE_URL}/tools/pdf-to-gsheet`, anchor: "PDF to Google Sheets" },
  { url: `${SITE_URL}/pricing`, anchor: "pricing" },
  { url: `${SITE_URL}/blog`, anchor: "our blog" },
];

// HIGH-CONVERSION content templates — targets buyer-intent keywords
const CONTENT_TEMPLATES = [
  {
    type: "buyer-guide",
    prompt: `Write a comprehensive buyer's guide for someone ready to purchase invoice processing software.
Target keywords: "best invoice OCR software", "invoice OCR pricing", "buy invoice automation tool".
Include a comparison table of 5+ tools with pricing, a "Who should buy what" section, and position InvoiceToData as the best value option.
Include a clear pricing/CTA section mentioning InvoiceToData's free tier and paid plans.`,
  },
  {
    type: "roi-analysis",
    prompt: `Write a detailed ROI analysis article about implementing invoice automation.
Target keywords: "invoice automation ROI", "cost of manual invoice processing", "invoice OCR cost savings".
Include real calculations: time saved per invoice, cost per invoice manually vs automated, annual savings for different business sizes.
Use a table showing ROI for small (100 invoices/mo), medium (500), and large (2000+) businesses.
End with CTA: "Calculate your savings — try InvoiceToData free".`,
  },
  {
    type: "vs-manual",
    prompt: `Write an article comparing manual invoice processing vs automated solutions in detail.
Target keywords: "manual vs automated invoice processing", "why automate invoices", "invoice automation benefits".
Include real-world time comparisons, error rates, cost analysis.
Use before/after scenarios with specific numbers.
Position InvoiceToData as the easy-to-adopt solution with free tier.`,
  },
  {
    type: "migration-guide",
    prompt: `Write a practical migration guide for businesses switching from manual invoice processing to automation.
Target keywords: "switch to invoice automation", "implement invoice OCR", "invoice automation setup guide".
Include: planning checklist, tool selection criteria, implementation timeline, common pitfalls.
Recommend InvoiceToData for businesses that want to start quickly with zero setup.`,
  },
  {
    type: "pricing-comparison",
    prompt: `Write a comprehensive pricing comparison of invoice OCR tools in 2026.
Target keywords: "invoice OCR pricing comparison", "cheapest invoice OCR", "invoice automation cost".
Compare pricing of: ABBYY, Nanonets, Klippa, Rossum, Docsumo, Mindee, Veryfi, and InvoiceToData.
Include a pricing table, free tier comparison, cost per page, and value analysis.
Highlight that InvoiceToData offers a free tier and competitive pricing.`,
  },
  {
    type: "case-study",
    prompt: `Write a realistic case study about a business that improved their invoice processing with automation.
Target keywords: "invoice automation case study", "invoice OCR results", "invoice processing improvement".
Create a compelling story: company background, the problem (manual processing), the solution (InvoiceToData), the results (time saved, errors reduced, cost savings).
Include specific metrics: "reduced processing time from 15 minutes to 30 seconds per invoice".`,
  },
  {
    type: "integration-guide",
    prompt: `Write a detailed guide about integrating invoice OCR with popular business tools.
Target keywords: "invoice OCR integration", "connect invoice data to accounting software", "invoice automation workflow".
Cover integrations with: QuickBooks, Xero, Google Sheets, Excel, Zapier.
Show how InvoiceToData fits into existing workflows and saves time.`,
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

async function pingSitemap(): Promise<void> {
  try {
    await fetch(
      `https://www.google.com/ping?sitemap=${SITE_URL}/sitemap.xml`,
      { signal: AbortSignal.timeout(10000) }
    );
  } catch { /* non-critical */ }
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error("Missing ANTHROPIC_API_KEY");
    if (!hasSupabaseConfig) throw new Error("Missing Supabase config");

    const dayOfYear = Math.floor(
      (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
    );
    const template = CONTENT_TEMPLATES[dayOfYear % CONTENT_TEMPLATES.length];

    const supabase = getSupabase();
    const { data: existingPosts } = await supabase
      .from("blogs")
      .select("title, slug")
      .order("created_at", { ascending: false })
      .limit(30);

    const existingTitles = (existingPosts ?? []).map((p) => p.title).join(", ");
    const existingSlugs = (existingPosts ?? []).map((p) => p.slug);

    const internalLinksInstruction = INTERNAL_LINKS.map(
      (l) => `- Link to ${l.url} with anchor text "${l.anchor}" at least once`
    ).join("\n");

    const recentPosts = (existingPosts ?? []).slice(0, 5);
    const recentLinksInstruction = recentPosts
      .map((p) => `- You may link to ${SITE_URL}/blog/${p.slug} (titled: "${p.title}")`)
      .join("\n");

    const fullPrompt = `You are an expert SEO content writer for InvoiceToData (${SITE_URL}), a SaaS tool that converts invoices into structured data using AI OCR.

${template.prompt}

IMPORTANT — THIS IS CONVERSION-FOCUSED CONTENT:
- Article must be 1500-2500 words
- Write in English
- Target BUYER-INTENT keywords (people ready to purchase/try a solution)
- Include pricing mentions, ROI data, and clear CTAs throughout
- Every major section should end with a soft CTA like "Try InvoiceToData free →" or "See pricing →"
- Include a compelling "## Why Choose InvoiceToData" section near the end
- Do NOT use the same topic as: ${existingTitles}

INTERNAL LINKING:
${internalLinksInstruction}
${recentLinksInstruction}

CONVERSION ELEMENTS TO INCLUDE:
- At least 2 CTAs linking to ${SITE_URL}/tools/pdf-to-excel or ${SITE_URL}/pricing
- A comparison table if relevant
- Specific numbers (time saved, cost reduced, error rates)
- Social proof language ("thousands of businesses", "used by accounting firms worldwide")
- A ## Frequently Asked Questions section with 3-5 buyer-focused Q&As

STRUCTURE:
- Start with ## Introduction (hook with a business pain point and cost implication)
- Use ## for main sections, ### for subsections
- Include a ## Conclusion with strong CTA
- Add "Related:" section linking to 2-3 existing blog posts

FORMAT YOUR RESPONSE EXACTLY LIKE THIS:
TITLE: [Buyer-intent SEO title]
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
    const metaMatch = response.match(/META:\s*(.+)/);
    const keywordsMatch = response.match(/KEYWORDS:\s*(.+)/);
    const contentStart = response.indexOf("---");

    if (!titleMatch || contentStart === -1) {
      throw new Error("Failed to parse Claude response");
    }

    const title = titleMatch[1].trim();
    const metaDescription = metaMatch?.[1]?.trim().slice(0, 160) ?? "";
    const keywords = keywordsMatch?.[1]?.trim() ?? "";
    const content = response.slice(contentStart + 3).trim();
    let slug = slugify(title);

    if (existingSlugs.includes(slug)) {
      const dateSuffix = new Date().toISOString().slice(0, 10);
      slug = `${slug}-${dateSuffix}`;
    }

    const { error } = await supabase
      .from("blogs")
      .insert({ title, slug, meta_description: metaDescription, keywords, content })
      .select()
      .single();

    if (error) throw new Error(`Supabase insert failed: ${error.message}`);

    await pingSitemap();

    const msg = `✅ <b>Conversion Blog Post Published!</b>

📝 <b>${title}</b>
📂 Type: ${template.type} (buyer-intent)
🔑 Keywords: ${keywords}
🔗 <a href="${SITE_URL}/blog/${slug}">View Post</a>

💰 Conversion-optimized with CTAs and pricing mentions
✅ Google sitemap ping sent`;

    await sendTelegramMessage(msg);

    return NextResponse.json({ success: true, slug, type: template.type });
  } catch (err) {
    console.error("[SEO Content-2 Cron] Error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    await sendTelegramMessage(`❌ <b>SEO Content-2 Cron Failed</b>\n\nError: ${message}`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
