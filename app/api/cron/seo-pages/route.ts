import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getSupabase, hasSupabaseConfig } from "@/lib/supabase";
import { sendTelegramMessage } from "@/lib/telegram";

/**
 * Vercel Cron Job — runs every Sunday at 2:00 AM UTC
 * Creates programmatic SEO landing pages:
 * - Competitor comparison pages (InvoiceToData vs X)
 * - Use-case pages (Invoice OCR for [industry])
 * - Feature pages (Invoice [feature] software)
 */

const GEMINI_MODEL = "gemini-flash-lite-latest";

// Programmatic page templates
const COMPETITOR_PAGES = [
  { name: "Klippa", slug: "invoicetodata-vs-klippa" },
  { name: "Nanonets", slug: "invoicetodata-vs-nanonets" },
  { name: "Rossum", slug: "invoicetodata-vs-rossum" },
  { name: "Docsumo", slug: "invoicetodata-vs-docsumo" },
  { name: "Mindee", slug: "invoicetodata-vs-mindee" },
  { name: "ABBYY", slug: "invoicetodata-vs-abbyy" },
  { name: "Veryfi", slug: "invoicetodata-vs-veryfi" },
  { name: "Amazon Textract", slug: "invoicetodata-vs-amazon-textract" },
];

const USE_CASE_PAGES = [
  { industry: "Small Business", slug: "invoice-ocr-for-small-business" },
  { industry: "Accounting Firms", slug: "invoice-ocr-for-accounting-firms" },
  { industry: "E-commerce", slug: "invoice-ocr-for-ecommerce" },
  { industry: "Construction", slug: "invoice-ocr-for-construction" },
  { industry: "Healthcare", slug: "invoice-ocr-for-healthcare" },
  { industry: "Freelancers", slug: "invoice-ocr-for-freelancers" },
  { industry: "Restaurants", slug: "invoice-ocr-for-restaurants" },
  { industry: "Real Estate", slug: "invoice-ocr-for-real-estate" },
];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await createNextPage();
    return NextResponse.json(result);
  } catch (err) {
    console.error("[SEO Pages Cron] Error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";

    await sendTelegramMessage(
      `❌ <b>SEO Pages Cron Failed</b>\n\nError: ${message}`
    );

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function createNextPage() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Missing GEMINI_API_KEY");
  if (!hasSupabaseConfig) throw new Error("Missing Supabase config");

  const supabase = getSupabase();

  // Find which pages haven't been created yet
  const allPages = [
    ...COMPETITOR_PAGES.map((p) => ({ ...p, type: "comparison" as const })),
    ...USE_CASE_PAGES.map((p) => ({ ...p, type: "use-case" as const })),
  ];

  const { data: existingPosts } = await supabase
    .from("blogs")
    .select("slug")
    .in("slug", allPages.map((p) => p.slug));

  const existingSlugs = new Set((existingPosts ?? []).map((p) => p.slug));
  const pendingPages = allPages.filter((p) => !existingSlugs.has(p.slug));

  if (pendingPages.length === 0) {
    await sendTelegramMessage(
      "✅ <b>All programmatic SEO pages created!</b>\n\n" +
      `${COMPETITOR_PAGES.length} competitor pages + ${USE_CASE_PAGES.length} use-case pages = ${allPages.length} total`
    );
    return { success: true, message: "All pages already exist", remaining: 0 };
  }

  // Create the next pending page
  const page = pendingPages[0];

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

  let prompt: string;

  if (page.type === "comparison" && "name" in page) {
    prompt = `Write a detailed comparison page: "InvoiceToData vs ${page.name}" for invoice OCR/data extraction.

STRUCTURE:
## InvoiceToData vs ${page.name}: Which Invoice OCR Tool is Right for You?

Write a fair but InvoiceToData-favoring comparison covering:
1. Quick comparison table (features, pricing, ease of use, accuracy, integrations, free tier)
2. Overview of each tool (2-3 paragraphs each)
3. Key differences (detailed comparison of 5-6 features)
4. Pricing comparison
5. Who should choose which tool
6. FAQ section (4-5 questions like "Is InvoiceToData better than ${page.name}?")
7. Conclusion with CTA

Target keywords: InvoiceToData vs ${page.name}, ${page.name} alternative, ${page.name} competitor
Include links to https://invoicetodata.com and https://invoicetodata.com/tools/pdf-to-excel
Article should be 1500-2000 words.`;
  } else if ("industry" in page) {
    prompt = `Write a landing page about Invoice OCR for ${page.industry}.

STRUCTURE:
## Invoice OCR for ${page.industry}: Automate Your Invoice Processing

Write a targeted page covering:
1. Pain points of invoice processing in ${page.industry}
2. How invoice OCR solves these problems
3. Key features needed for ${page.industry} (with InvoiceToData feature highlights)
4. Step-by-step how to get started
5. ROI and time savings (use realistic numbers)
6. FAQ section (3-4 industry-specific questions)
7. CTA to try InvoiceToData

Target keywords: invoice OCR ${page.industry.toLowerCase()}, invoice processing ${page.industry.toLowerCase()}, automated invoicing ${page.industry.toLowerCase()}
Include links to https://invoicetodata.com and https://invoicetodata.com/tools/pdf-to-excel
Article should be 1200-1800 words.`;
  } else {
    throw new Error("Unknown page type");
  }

  const fullPrompt = `You are an expert SEO copywriter. ${prompt}

FORMAT YOUR RESPONSE EXACTLY LIKE THIS:
TITLE: [SEO-optimized title]
META: [Meta description, max 155 characters]
KEYWORDS: [keyword1, keyword2, keyword3, keyword4, keyword5]
---
[Content in Markdown]`;

  // Call Gemini with retry
  let response: string | null = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const result = await model.generateContent(fullPrompt);
      response = result.response.text();
      break;
    } catch (err) {
      if (attempt < 3) {
        await sleep(5000 * attempt);
        continue;
      }
      throw err;
    }
  }

  if (!response) throw new Error("Failed to generate content");

  // Parse response
  const titleMatch = response.match(/TITLE:\s*(.+)/);
  const metaMatch = response.match(/META:\s*(.+)/);
  const keywordsMatch = response.match(/KEYWORDS:\s*(.+)/);
  const contentStart = response.indexOf("---");

  if (!titleMatch || contentStart === -1) {
    throw new Error("Failed to parse Gemini response");
  }

  const title = titleMatch[1].trim();
  const metaDescription = metaMatch?.[1]?.trim().slice(0, 160) ?? "";
  const keywords = keywordsMatch?.[1]?.trim() ?? "";
  const content = response.slice(contentStart + 3).trim();

  // Insert into database
  const { error } = await supabase
    .from("blogs")
    .insert({
      title,
      slug: page.slug,
      meta_description: metaDescription,
      keywords,
      content,
    })
    .select()
    .single();

  if (error) throw new Error(`Supabase insert failed: ${error.message}`);

  // Ping Google sitemap
  try {
    await fetch("https://www.google.com/ping?sitemap=https://www.invoicetodata.com/sitemap.xml");
  } catch { /* non-critical */ }

  // Notify
  const url = `https://invoicetodata.com/blog/${page.slug}`;
  await sendTelegramMessage(
    `✅ <b>New SEO Landing Page Created!</b>\n\n` +
    `📝 <b>${title}</b>\n` +
    `📂 Type: Programmatic ${page.type}\n` +
    `🔗 <a href="${url}">View Page</a>\n\n` +
    `📊 Remaining: ${pendingPages.length - 1} pages to create`
  );

  return { success: true, slug: page.slug, type: page.type, remaining: pendingPages.length - 1 };
}
