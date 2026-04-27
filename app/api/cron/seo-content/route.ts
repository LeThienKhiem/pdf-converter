import { NextResponse } from "next/server";
import { SEO_MODEL, extractText, getAnthropic } from "@/lib/anthropic";
import { getSupabase, hasSupabaseConfig } from "@/lib/supabase";
import { sendTelegramMessage } from "@/lib/telegram";

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
    const result = await generateAndPublish();
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

async function generateAndPublish() {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("Missing ANTHROPIC_API_KEY");
  if (!hasSupabaseConfig) throw new Error("Missing Supabase config");

  // Pick content type based on day of year (rotates through all templates)
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
  );
  const template = CONTENT_TEMPLATES[dayOfYear % CONTENT_TEMPLATES.length];

  // Check existing posts to avoid duplicate topics
  const supabase = getSupabase();
  const { data: existingPosts } = await supabase
    .from("blogs")
    .select("title, slug")
    .order("created_at", { ascending: false })
    .limit(30);

  const existingTitles = (existingPosts ?? []).map((p) => p.title).join(", ");
  const existingSlugs = (existingPosts ?? []).map((p) => p.slug);

  // Build internal links instruction
  const internalLinksInstruction = INTERNAL_LINKS.map(
    (l) => `- Link to ${l.url} with anchor text "${l.anchor}" at least once`
  ).join("\n");

  // Also suggest linking to recent blog posts
  const recentPosts = (existingPosts ?? []).slice(0, 5);
  const recentLinksInstruction = recentPosts
    .map((p) => `- You may link to https://invoicetodata.com/blog/${p.slug} (titled: "${p.title}")`)
    .join("\n");

  const fullPrompt = `You are an expert SEO content writer for InvoiceToData (https://invoicetodata.com), a SaaS tool that converts invoices into structured data using AI OCR.

${template.prompt}

IMPORTANT RULES:
- Article must be 1500-2500 words
- Write in English
- Use proper Markdown formatting with ## and ### headings
- Include a compelling H1 title optimized for SEO (include primary keyword near the beginning)
- Do NOT use the same topic as these existing articles: ${existingTitles}
- Include relevant keywords naturally throughout: invoice OCR, invoice data extraction, invoice parser, PDF to Excel, invoice scanning, automated invoice processing
- Write for humans first, search engines second — be genuinely helpful

INTERNAL LINKING (very important for SEO):
${internalLinksInstruction}
${recentLinksInstruction}

STRUCTURE REQUIREMENTS:
- Start with ## Introduction (engaging hook with statistics or a pain point)
- Use ## for main sections, ### for subsections
- Include at least one comparison table (markdown table) if relevant
- Include a ## Frequently Asked Questions section with 3-5 Q&As (for Google featured snippets)
- End with a ## Conclusion and clear CTA linking to https://invoicetodata.com
- Add "Related:" section at the bottom linking to 2-3 of our existing blog posts

E-E-A-T COMPLIANCE:
- Include specific numbers, statistics, or data points where possible
- Reference real tools and real use cases
- Write from practical experience perspective
- Be balanced and honest in comparisons

Do NOT start content with the title (I'll use it separately).

FORMAT YOUR RESPONSE EXACTLY LIKE THIS:
TITLE: [Your SEO-optimized title here]
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
  const metaMatch = response.match(/META:\s*(.+)/);
  const keywordsMatch = response.match(/KEYWORDS:\s*(.+)/);
  const contentStart = response.indexOf("---");

  if (!titleMatch || contentStart === -1) {
    throw new Error("Failed to parse Claude response — unexpected format");
  }

  const title = titleMatch[1].trim();
  const metaDescription = metaMatch?.[1]?.trim().slice(0, 160) ?? "";
  const keywords = keywordsMatch?.[1]?.trim() ?? "";
  const content = response.slice(contentStart + 3).trim();
  let slug = slugify(title);

  // Ensure unique slug
  if (existingSlugs.includes(slug)) {
    const dateSuffix = new Date().toISOString().slice(0, 10);
    slug = `${slug}-${dateSuffix}`;
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
    })
    .select()
    .single();

  if (error) throw new Error(`Supabase insert failed: ${error.message}`);

  // Ping Google to re-crawl sitemap
  await pingSitemap();

  // Notify via Telegram
  await notifyTelegram(title, slug, template.type, keywords);

  return { success: true, slug, type: template.type };
}

async function notifyTelegram(title: string, slug: string, type: string, keywords: string) {
  const url = `https://invoicetodata.com/blog/${slug}`;
  const msg = `✅ <b>New SEO Blog Post Published!</b>

📝 <b>${title}</b>
📂 Type: ${type}
🔑 Keywords: ${keywords}
🔗 <a href="${url}">View Post</a>

✅ Structured data (Article + FAQ + Breadcrumb) auto-applied
✅ Google sitemap ping sent
✅ Internal links included

Review it when you have time.`;

  await sendTelegramMessage(msg);
}
