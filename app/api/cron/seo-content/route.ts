import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getSupabase, hasSupabaseConfig } from "@/lib/supabase";
import { sendTelegramMessage } from "@/lib/telegram";

/**
 * Vercel Cron Job — runs daily at 1:00 AM UTC
 * Automatically generates SEO blog content using Gemini and publishes to Supabase
 */

const GEMINI_MODEL = "gemini-flash-lite-latest";

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

    // Notify via Telegram on failure
    await sendTelegramMessage(
      `❌ <b>SEO Content Cron Failed</b>\n\nError: ${message}\n\nPlease check Vercel logs.`
    );

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function generateAndPublish() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Missing GEMINI_API_KEY");
  if (!hasSupabaseConfig) throw new Error("Missing Supabase config");

  // Pick content type based on day of year (rotates through templates)
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
    .limit(20);

  const existingTitles = (existingPosts ?? []).map((p) => p.title).join(", ");

  // Generate content with Gemini
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

  const fullPrompt = `You are an expert SEO content writer for InvoiceToData (https://invoicetodata.com), a SaaS tool that converts invoices into structured data using AI OCR.

${template.prompt}

IMPORTANT RULES:
- Article must be 1500-2500 words
- Write in English
- Use proper Markdown formatting with ## and ### headings
- Include a compelling H1 title optimized for SEO
- Do NOT use the same topic as these existing articles: ${existingTitles}
- Include relevant keywords naturally: invoice OCR, invoice data extraction, invoice parser, PDF to Excel, invoice scanning
- Include internal links to https://invoicetodata.com where appropriate
- Include a FAQ section with 3-5 questions at the end (for Google featured snippets)
- End with a clear CTA linking to https://invoicetodata.com
- Write helpful, accurate, E-E-A-T compliant content
- Do NOT start content with the title (I'll use it separately)

FORMAT YOUR RESPONSE EXACTLY LIKE THIS:
TITLE: [Your SEO-optimized title here]
META: [Meta description, max 155 characters]
KEYWORDS: [keyword1, keyword2, keyword3, keyword4, keyword5]
---
[Article content in Markdown starting with ## Introduction]`;

  const result = await model.generateContent(fullPrompt);
  const response = result.response.text();

  // Parse the response
  const titleMatch = response.match(/TITLE:\s*(.+)/);
  const metaMatch = response.match(/META:\s*(.+)/);
  const keywordsMatch = response.match(/KEYWORDS:\s*(.+)/);
  const contentStart = response.indexOf("---");

  if (!titleMatch || contentStart === -1) {
    throw new Error("Failed to parse Gemini response — unexpected format");
  }

  const title = titleMatch[1].trim();
  const metaDescription = metaMatch?.[1]?.trim().slice(0, 160) ?? "";
  const keywords = keywordsMatch?.[1]?.trim() ?? "";
  const content = response.slice(contentStart + 3).trim();
  const slug = slugify(title);

  // Check for duplicate slug
  const { data: existing } = await supabase
    .from("blogs")
    .select("id")
    .eq("slug", slug)
    .single();

  if (existing) {
    // Add date suffix to make unique
    const dateSuffix = new Date().toISOString().slice(0, 10);
    const uniqueSlug = `${slug}-${dateSuffix}`;

    const { error } = await supabase
      .from("blogs")
      .insert({
        title,
        slug: uniqueSlug,
        meta_description: metaDescription,
        keywords,
        content,
      })
      .select()
      .single();

    if (error) throw new Error(`Supabase insert failed: ${error.message}`);

    await notifyTelegram(title, uniqueSlug, template.type);
    return { success: true, slug: uniqueSlug, type: template.type };
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

  await notifyTelegram(title, slug, template.type);
  return { success: true, slug, type: template.type };
}

async function notifyTelegram(title: string, slug: string, type: string) {
  const url = `https://invoicetodata.com/blog/${slug}`;
  const msg = `✅ <b>New SEO Blog Post Published!</b>

📝 <b>${title}</b>
📂 Type: ${type}
🔗 <a href="${url}">${url}</a>

The post was automatically generated and published by your SEO agent. Review it when you have time.`;

  await sendTelegramMessage(msg);
}
