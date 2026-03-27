import { NextResponse } from "next/server";
import { sendTelegramMessage } from "@/lib/telegram";
import { getSupabase, hasSupabaseConfig } from "@/lib/supabase";

/**
 * Vercel Cron Job — runs daily at 8:00 AM UTC (3:00 PM VN)
 * Comprehensive SEO performance report with keyword ranking tracking
 */

const TARGET_KEYWORDS = [
  "invoice data extraction",
  "invoice OCR",
  "invoice OCR software",
  "extract data from invoice",
  "invoice parser",
  "convert invoice to excel",
  "best invoice OCR software 2026",
  "invoice scanning software",
  "AI invoice data extraction",
  "PDF invoice data extraction",
];

const SITE_DOMAIN = "invoicetodata.com";

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
    console.error("[SEO Report Cron] Error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Check Google ranking for a keyword using Custom Search API
 * Returns position (1-100) or null if not found
 */
async function checkKeywordRanking(
  keyword: string,
  apiKey: string,
  searchEngineId: string
): Promise<{ position: number | null; url: string | null }> {
  try {
    // Search first 30 results (3 pages of 10)
    for (let start = 1; start <= 21; start += 10) {
      const params = new URLSearchParams({
        key: apiKey,
        cx: searchEngineId,
        q: keyword,
        start: String(start),
        num: "10",
      });

      const res = await fetch(
        `https://www.googleapis.com/customsearch/v1?${params}`,
        { signal: AbortSignal.timeout(10000) }
      );

      if (!res.ok) continue;

      const data = await res.json();
      const items = data.items ?? [];

      for (let i = 0; i < items.length; i++) {
        const link: string = items[i].link ?? "";
        if (link.includes(SITE_DOMAIN)) {
          return {
            position: start + i,
            url: link,
          };
        }
      }
    }
    return { position: null, url: null };
  } catch {
    return { position: null, url: null };
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

  // --- 1. Blog stats from Supabase ---
  let totalPosts = 0;
  let latestPost = "N/A";
  let postsThisWeek = 0;
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

    // Posts in last 7 days
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { count: weekCount } = await supabase
      .from("blogs")
      .select("*", { count: "exact", head: true })
      .gte("created_at", weekAgo);
    postsThisWeek = weekCount ?? 0;
  }

  // --- 2. Website uptime check ---
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

  // --- 3. Key pages health check ---
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

  // --- 4. Keyword Ranking Check (if Google API is configured) ---
  const googleApiKey = process.env.GOOGLE_SEARCH_API_KEY ?? "";
  const searchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID ?? "";
  let rankingSection = "";

  if (googleApiKey && searchEngineId) {
    const rankings: string[] = [];
    let foundCount = 0;
    let bestRank = Infinity;
    let bestKeyword = "";

    for (const keyword of TARGET_KEYWORDS) {
      const result = await checkKeywordRanking(keyword, googleApiKey, searchEngineId);

      if (result.position !== null) {
        foundCount++;
        const emoji =
          result.position <= 10 ? "🟢" : result.position <= 20 ? "🟡" : "🟠";
        rankings.push(`  ${emoji} #${result.position} — ${keyword}`);
        if (result.position < bestRank) {
          bestRank = result.position;
          bestKeyword = keyword;
        }
      } else {
        rankings.push(`  ⚪ Not in top 30 — ${keyword}`);
      }

      // Rate limit: small delay between searches
      await new Promise((r) => setTimeout(r, 500));
    }

    rankingSection = `
<b>🏆 Keyword Rankings (Top 30)</b>
${rankings.join("\n")}
  📊 Found: ${foundCount}/${TARGET_KEYWORDS.length} keywords ranked
${bestRank < Infinity ? `  ⭐ Best: #${bestRank} for "${bestKeyword}"` : "  🎯 Goal: Get at least 1 keyword into top 30"}`;
  } else {
    rankingSection = `
<b>🏆 Keyword Rankings</b>
  ⚠️ Google Custom Search API not configured
  Add GOOGLE_SEARCH_API_KEY and GOOGLE_SEARCH_ENGINE_ID to Vercel env to enable automatic ranking tracking`;
  }

  // --- 5. Sitemap check ---
  let sitemapStatus = "❌ Error";
  try {
    const res = await fetch("https://invoicetodata.com/sitemap.xml", {
      signal: AbortSignal.timeout(10000),
    });
    if (res.ok) {
      const text = await res.text();
      const urlCount = (text.match(/<url>/g) ?? []).length;
      sitemapStatus = `✅ ${urlCount} URLs indexed`;
    }
  } catch {
    sitemapStatus = "❌ Unreachable";
  }

  // --- 6. Weekly progress summary ---
  const dayOfWeek = now.getDay();
  const campaignStart = new Date("2026-03-26");
  const campaignDays = Math.floor((now.getTime() - campaignStart.getTime()) / 86400000);
  const campaignWeeks = Math.floor(campaignDays / 7);

  // --- Build report ---
  const report = `
<b>📈 InvoiceToData SEO Daily Report</b>
<i>${dateStr} — Week ${campaignWeeks + 1}</i>

<b>🌐 Website Health</b>
  ${siteStatus} (${responseTime}ms)
${pageChecks.join("\n")}
  🗺️ Sitemap: ${sitemapStatus}
${rankingSection}

<b>📝 Content Stats</b>
  Total blog posts: ${totalPosts}
  New this week: ${postsThisWeek}
  Latest: ${latestPost}

<b>📋 SEO Checklist</b>
  ${totalPosts >= 10 ? "✅" : "🔲"} Publish 10+ blog posts (${totalPosts}/10)
  ${totalPosts >= 20 ? "✅" : "🔲"} Publish 20+ blog posts (${totalPosts}/20)
  🔲 Submit to Google Search Console
  🔲 Submit to 5+ directories (G2, Capterra, Product Hunt)
  🔲 Get first backlink

<a href="https://invoicetodata.com/blog">Blog</a> | <a href="https://search.google.com/search-console">Search Console</a> | <a href="https://invoicetodata.com/sitemap.xml">Sitemap</a>
`.trim();

  return report;
}
