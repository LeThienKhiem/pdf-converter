import { NextResponse } from "next/server";
import { SEO_MODEL, extractText, getAnthropic } from "@/lib/anthropic";
import { getSupabase, hasSupabaseConfig } from "@/lib/supabase";
import { sendTelegramMessage } from "@/lib/telegram";
import { summarizeExistingPost } from "@/lib/seoContent";

/**
 * Refreshes the oldest stale blog post (>30d since last update) so Google
 * sees fresh content. Exposed both as its own GET handler (for manual
 * trigger) and as the exported runContentRefresh() runner used by the
 * master cron.
 *
 * Layer 1 follow-up: when refreshing, we also regenerate the post's
 * `summary` so Layer 1's dedup gate sees the updated angle, not the stale
 * pre-refresh one.
 */

export type RefreshResult =
  | { success: true; refreshed: string; title: string }
  | { success: true; skipped: true; reason: string };

export async function runContentRefresh(): Promise<RefreshResult> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("Missing ANTHROPIC_API_KEY");
  if (!hasSupabaseConfig) throw new Error("Missing Supabase config");

  const supabase = getSupabase();

  // Find the oldest blog post that hasn't been updated in 30+ days
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: oldPosts } = await supabase
    .from("blogs")
    .select("id, title, slug, content, keywords, created_at, updated_at")
    .or(`updated_at.is.null,updated_at.lt.${thirtyDaysAgo}`)
    .order("updated_at", { ascending: true, nullsFirst: true })
    .limit(1);

  if (!oldPosts || oldPosts.length === 0) {
    await sendTelegramMessage(
      "ℹ️ <b>Content Refresh:</b> No posts need refreshing yet (all updated within 30 days)."
    );
    return { success: true, skipped: true, reason: "nothing-stale" };
  }

  const post = oldPosts[0];

  // Get recent posts for internal linking
  const { data: recentPosts } = await supabase
    .from("blogs")
    .select("title, slug")
    .neq("id", post.id)
    .order("created_at", { ascending: false })
    .limit(5);

  const recentLinksInstruction = (recentPosts ?? [])
    .map((p) => `- https://invoicetodata.com/blog/${p.slug} ("${p.title}")`)
    .join("\n");

  const prompt = `You are an expert SEO content editor. Your job is to REFRESH and IMPROVE an existing blog post to make it more current and comprehensive.

EXISTING ARTICLE TITLE: ${post.title}
EXISTING ARTICLE KEYWORDS: ${post.keywords || "invoice OCR, invoice data extraction"}

EXISTING CONTENT:
${post.content.substring(0, 4000)}

YOUR TASK:
1. Keep the same overall structure and topic
2. Update any outdated information, statistics, or year references to 2026
3. Add 1-2 NEW sections (200-400 words total) with fresh insights, trends, or tips
4. Improve existing paragraphs where they feel thin or generic
5. Add internal links to these recent posts where relevant:
${recentLinksInstruction}
6. Also link to https://invoicetodata.com and https://invoicetodata.com/tools/pdf-to-excel where appropriate
7. Keep the ## FAQ section and add 1-2 new Q&As if possible
8. Make sure the content reads naturally and is genuinely helpful

IMPORTANT:
- Output the FULL updated article in Markdown
- Do NOT include the title (I'll keep the original)
- Start directly with the content (## Introduction or first section)
- Keep all existing good content, just enhance it
- The total article should be 1800-3000 words`;

  const client = getAnthropic();
  const message = await client.messages.create({
    model: SEO_MODEL,
    max_tokens: 16000,
    output_config: { effort: "medium" },
    messages: [{ role: "user", content: prompt }],
  });
  const refreshedContent = extractText(message);

  // Regenerate the summary so Layer 1's dedup gate works against the
  // updated angle, not the stale pre-refresh snapshot. One extra Haiku
  // call (~$0.001) to keep the dedup signal accurate.
  let refreshedSummary: string | null = null;
  try {
    refreshedSummary = await summarizeExistingPost({
      title: post.title,
      content: refreshedContent,
      client,
    });
  } catch (err) {
    console.error("[Content Refresh] Summary regen failed (non-fatal):", err);
  }

  // Update the post in Supabase
  const updatePayload: Record<string, unknown> = {
    content: refreshedContent,
    updated_at: new Date().toISOString(),
  };
  if (refreshedSummary) updatePayload.summary = refreshedSummary;

  const { error } = await supabase
    .from("blogs")
    .update(updatePayload)
    .eq("id", post.id);

  if (error) throw new Error(`Supabase update failed: ${error.message}`);

  // Ping Google (non-critical)
  try {
    await fetch(
      "https://www.google.com/ping?sitemap=https://invoicetodata.com/sitemap.xml",
      { signal: AbortSignal.timeout(10000) }
    );
  } catch {
    /* non-critical */
  }

  await sendTelegramMessage(
    `🔄 <b>Content Refreshed!</b>\n\n` +
      `📝 <b>${post.title}</b>\n` +
      `🔗 <a href="https://invoicetodata.com/blog/${post.slug}">View Post</a>\n` +
      `📅 Originally: ${post.created_at?.slice(0, 10) ?? "unknown"}\n` +
      `✅ Updated with fresh content + new sections\n` +
      `${refreshedSummary ? "✅" : "⚠️"} Summary ${refreshedSummary ? "regenerated" : "unchanged"} for dedup gate`
  );

  return { success: true, refreshed: post.slug, title: post.title };
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runContentRefresh();
    return NextResponse.json(result);
  } catch (err) {
    console.error("[Content Refresh Cron] Error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    await sendTelegramMessage(`❌ <b>Content Refresh Failed</b>\n\nError: ${message}`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
