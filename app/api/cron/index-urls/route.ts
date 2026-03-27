import { NextResponse } from "next/server";
import { getSupabase, hasSupabaseConfig } from "@/lib/supabase";
import { sendTelegramMessage } from "@/lib/telegram";

/**
 * Vercel Cron Job — runs every 6 hours
 * Auto-submits new blog URLs to Google Indexing API and pings Bing
 * for faster indexing of new content.
 *
 * Uses Google Custom Search API to check if URL is already indexed,
 * then submits unindexed URLs via Google's indexing ping + Bing Webmaster.
 */

const SITE_URL = "https://invoicetodata.com";

/** Ping Google to re-crawl sitemap */
async function pingGoogle(): Promise<boolean> {
  try {
    const res = await fetch(
      `https://www.google.com/ping?sitemap=${SITE_URL}/sitemap.xml`,
      { signal: AbortSignal.timeout(10000) }
    );
    return res.ok;
  } catch {
    return false;
  }
}

/** Ping Bing to re-crawl sitemap */
async function pingBing(): Promise<boolean> {
  try {
    const res = await fetch(
      `https://www.bing.com/ping?sitemap=${encodeURIComponent(`${SITE_URL}/sitemap.xml`)}`,
      { signal: AbortSignal.timeout(10000) }
    );
    return res.ok;
  } catch {
    return false;
  }
}

/** Check if a URL is indexed by Google using Custom Search API */
async function checkGoogleIndex(url: string): Promise<boolean> {
  const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
  const engineId = process.env.GOOGLE_SEARCH_ENGINE_ID;
  if (!apiKey || !engineId) return false;

  try {
    const query = encodeURIComponent(`site:${url}`);
    const res = await fetch(
      `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${engineId}&q=${query}`,
      { signal: AbortSignal.timeout(15000) }
    );
    const data = await res.json();
    const totalResults = parseInt(data.searchInformation?.totalResults ?? "0", 10);
    return totalResults > 0;
  } catch {
    return false;
  }
}

/** Submit URL to IndexNow (used by Bing, Yandex, etc.) */
async function submitIndexNow(urls: string[]): Promise<boolean> {
  if (urls.length === 0) return true;
  try {
    const res = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        host: "invoicetodata.com",
        urlList: urls,
        // IndexNow key — can be any string, just needs matching file at root
        key: "invoicetodata-indexnow-key",
      }),
      signal: AbortSignal.timeout(15000),
    });
    return res.ok || res.status === 202;
  } catch {
    return false;
  }
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    if (!hasSupabaseConfig) throw new Error("Missing Supabase config");

    const supabase = getSupabase();

    // Get all blog posts from last 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: recentPosts } = await supabase
      .from("blogs")
      .select("slug, title, created_at")
      .gte("created_at", sevenDaysAgo)
      .order("created_at", { ascending: false });

    // Get landing pages too
    const { data: landingPages } = await supabase
      .from("landing_pages")
      .select("slug")
      .limit(50);

    const blogUrls = (recentPosts ?? []).map(
      (p) => `${SITE_URL}/blog/${p.slug}`
    );
    const landingUrls = (landingPages ?? []).map(
      (p) => `${SITE_URL}/tools/${p.slug}`
    );
    const allUrls = [...blogUrls, ...landingUrls];

    // Check which URLs are not indexed yet (limit checks to save API quota)
    const unindexedUrls: string[] = [];
    const checkLimit = Math.min(blogUrls.length, 5); // Max 5 checks per run to save quota

    for (let i = 0; i < checkLimit; i++) {
      const isIndexed = await checkGoogleIndex(blogUrls[i]);
      if (!isIndexed) {
        unindexedUrls.push(blogUrls[i]);
      }
    }

    // Ping search engines
    const [googlePinged, bingPinged] = await Promise.all([
      pingGoogle(),
      pingBing(),
    ]);

    // Submit to IndexNow (Bing, Yandex, etc.)
    const indexNowSubmitted = await submitIndexNow(
      unindexedUrls.length > 0 ? unindexedUrls : allUrls.slice(0, 10)
    );

    // Send report to Telegram
    const report = `🔍 <b>URL Indexing Report</b>

📊 <b>Status</b>
• Recent blog posts (7 days): ${blogUrls.length}
• Landing pages: ${landingUrls.length}
• Checked for indexing: ${checkLimit}
• Not yet indexed: ${unindexedUrls.length}

🏓 <b>Pings Sent</b>
• Google Sitemap: ${googlePinged ? "✅" : "❌"}
• Bing Sitemap: ${bingPinged ? "✅" : "❌"}
• IndexNow (Bing/Yandex): ${indexNowSubmitted ? "✅" : "❌"}

${unindexedUrls.length > 0 ? `📋 <b>Unindexed URLs submitted:</b>\n${unindexedUrls.map((u) => `• ${u}`).join("\n")}` : "✅ All checked URLs are indexed!"}`;

    await sendTelegramMessage(report);

    return NextResponse.json({
      success: true,
      recentPosts: blogUrls.length,
      unindexed: unindexedUrls.length,
      googlePinged,
      bingPinged,
      indexNowSubmitted,
    });
  } catch (err) {
    console.error("[Index URLs Cron] Error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    await sendTelegramMessage(`❌ <b>URL Indexing Cron Failed</b>\n\nError: ${message}`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
