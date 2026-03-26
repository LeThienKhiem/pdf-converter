import { NextResponse } from "next/server";
import { sendTelegramMessage } from "@/lib/telegram";
import { getSupabase, hasSupabaseConfig } from "@/lib/supabase";

/**
 * Vercel Cron Job — runs daily at 8:00 AM UTC
 * Checks website SEO performance and sends report to Telegram
 */

// Protect the endpoint so only Vercel cron can call it
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const report = await generateSEOReport();
    const sent = await sendTelegramMessage(report);

    return NextResponse.json({
      success: true,
      telegramSent: sent,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[SEO Cron] Error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function generateSEOReport(): Promise<string> {
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // --- 1. Check blog post count ---
  let totalPosts = 0;
  let latestPost = "N/A";
  if (hasSupabaseConfig) {
    const supabase = getSupabase();
    const { count } = await supabase
      .from("blogs")
      .select("*", { count: "exact", head: true });
    totalPosts = count ?? 0;

    const { data: latest } = await supabase
      .from("blogs")
      .select("title, created_at")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (latest) {
      const postDate = new Date(latest.created_at).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      latestPost = `${latest.title} (${postDate})`;
    }
  }

  // --- 2. Check Google indexing via site: search ---
  let indexedPages = "Unable to check";
  try {
    // Use Google Custom Search API if available, otherwise note as manual check
    indexedPages = "Check manually: site:invoicetodata.com";
  } catch {
    // Silently handle
  }

  // --- 3. Check if site is up ---
  let siteStatus = "❌ Down";
  let responseTime = 0;
  try {
    const start = Date.now();
    const res = await fetch("https://invoicetodata.com", {
      method: "HEAD",
      signal: AbortSignal.timeout(10000),
    });
    responseTime = Date.now() - start;
    siteStatus = res.ok ? "✅ Online" : `⚠️ Status ${res.status}`;
  } catch {
    siteStatus = "❌ Unreachable";
  }

  // --- 4. Check key pages ---
  const keyPages = [
    { name: "Homepage", url: "https://invoicetodata.com" },
    { name: "Blog", url: "https://invoicetodata.com/blog" },
    { name: "PDF to Excel", url: "https://invoicetodata.com/tools/pdf-to-excel" },
  ];

  const pageChecks: string[] = [];
  for (const page of keyPages) {
    try {
      const res = await fetch(page.url, {
        method: "HEAD",
        signal: AbortSignal.timeout(10000),
      });
      pageChecks.push(`  ${res.ok ? "✅" : "❌"} ${page.name}: ${res.status}`);
    } catch {
      pageChecks.push(`  ❌ ${page.name}: Timeout`);
    }
  }

  // --- 5. Target keywords reminder ---
  const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon, ...
  const dailyTasks: Record<number, string> = {
    0: "📊 Weekly Summary — Compile insights & plan next week",
    1: "🔍 SEO Audit — Check rankings & competitor activity",
    2: "✍️ Blog Post — Write SEO content (Tier 2/3 keyword)",
    3: "🔧 Technical SEO — Audit site speed, mobile, schema",
    4: "📝 Comparison Page — Create vs-competitor content",
    5: "🔗 Link Building — Research backlink opportunities",
    6: "📖 Tutorial/Guide — Write how-to content (long-tail)",
  };

  const todayTask = dailyTasks[dayOfWeek] ?? "📋 General SEO work";

  // --- Build report ---
  const report = `
<b>📈 InvoiceToData SEO Daily Report</b>
<i>${dateStr}</i>

<b>🌐 Website Status</b>
  ${siteStatus} (${responseTime}ms)
${pageChecks.join("\n")}

<b>📝 Content</b>
  Total blog posts: ${totalPosts}
  Latest: ${latestPost}

<b>🎯 Today's SEO Task</b>
  ${todayTask}

<b>🔑 Target Keywords to Track</b>
  • invoice data extraction
  • invoice OCR
  • best invoice OCR software 2026
  • convert invoice to excel
  • invoice parser

<b>💡 Tip</b>
Open Claude Desktop to run the full SEO agent for content creation, keyword research, and detailed analysis.

<a href="https://invoicetodata.com/blog">View Blog</a> | <a href="https://search.google.com/search-console">Search Console</a>
`.trim();

  return report;
}
