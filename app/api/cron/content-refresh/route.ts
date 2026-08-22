import { NextResponse } from "next/server";
import { SEO_MODEL, extractText, getAnthropic } from "@/lib/anthropic";
import { getSupabase, hasSupabaseConfig } from "@/lib/supabase";
import { sendTelegramMessage } from "@/lib/telegram";
import { summarizeExistingPost, pickRelevantLinkTargets } from "@/lib/seoContent";

/**
 * Refreshes stale blog posts so Google sees fresh content. Exposed both as
 * its own GET handler (for manual trigger) and as the exported
 * runContentRefresh() runner used by the master cron.
 *
 * Layer 1 follow-up: when refreshing, we also regenerate the post's
 * `summary` so Layer 1's dedup gate sees the updated angle, not the stale
 * pre-refresh one.
 *
 * Target selection: driven by Search Console performance when
 * blog_gsc_stats has data, falling back to age. Age alone spent the single
 * weekly slot on whatever happened to be oldest; impressions-with-poor-CTR
 * points at the posts where Google is already showing the page and readers
 * are declining to click, which is where a rewrite actually pays.
 */

/** Vercel Hobby caps serverless duration at 60s; declare it rather than inherit. */
export const maxDuration = 60;

/**
 * Stop starting another refresh once this much of the budget is gone. One
 * Sonnet rewrite at 16k max_tokens is the dominant cost, so on Hobby this
 * effectively yields one post per run — but each post is committed as soon
 * as it finishes, so a timeout can never lose completed work. Raising
 * maxDuration (Pro) lets the same loop process more per run with no code
 * change.
 */
const TIME_BUDGET_MS = 40_000;

/** Never refresh more than this in one run, even with budget to spare. */
const MAX_PER_RUN = 3;

/** A post needs at least this many impressions to be worth a rewrite. */
const MIN_IMPRESSIONS_TO_PRIORITISE = 20;

export type RefreshResult =
  | { success: true; refreshed: string[]; count: number; selection: string }
  | { success: true; skipped: true; reason: string };

type RefreshCandidate = {
  id: string;
  title: string;
  slug: string;
  content: string;
  keywords: string | null;
  created_at: string | null;
  updated_at: string | null;
};

/**
 * Choose which posts to rewrite.
 *
 * Preferred order is "Google shows it, nobody clicks": highest impressions
 * with the worst CTR first. Falls back to oldest-first when blog_gsc_stats
 * is empty or missing, so this works before any CSV has been imported.
 */
async function selectRefreshTargets(
  supabase: ReturnType<typeof getSupabase>,
  limit: number
): Promise<{ posts: RefreshCandidate[]; selection: string }> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data: stalePosts } = await supabase
    .from("blogs")
    .select("id, title, slug, content, keywords, created_at, updated_at")
    .or(`updated_at.is.null,updated_at.lt.${thirtyDaysAgo}`)
    .order("updated_at", { ascending: true, nullsFirst: true })
    .limit(200);

  const stale = (stalePosts ?? []) as RefreshCandidate[];
  if (stale.length === 0) return { posts: [], selection: "none-stale" };

  // blog_gsc_stats is optional — the table may not exist yet.
  const { data: stats, error: statsErr } = await supabase
    .from("blog_gsc_stats")
    .select("slug, impressions, ctr, position")
    .gte("impressions", MIN_IMPRESSIONS_TO_PRIORITISE)
    .limit(2000);

  if (statsErr || !stats || stats.length === 0) {
    if (statsErr) {
      console.log(
        `[Content Refresh] blog_gsc_stats unavailable (${statsErr.message}) — using age-based selection.`
      );
    }
    return { posts: stale.slice(0, limit), selection: "age" };
  }

  type Stat = { slug: string; impressions: number; ctr: number; position: number | null };
  const bySlug = new Map<string, Stat>();
  for (const s of stats as Stat[]) bySlug.set(s.slug, s);

  const withStats = stale.filter((p) => bySlug.has(p.slug));
  if (withStats.length === 0) return { posts: stale.slice(0, limit), selection: "age" };

  withStats.sort((a, b) => {
    const sa = bySlug.get(a.slug)!;
    const sb = bySlug.get(b.slug)!;
    // Worst CTR first; impressions break ties so bigger audiences win.
    return sa.ctr - sb.ctr || sb.impressions - sa.impressions;
  });

  const chosen = withStats.slice(0, limit);
  // Top up from the stale pool if GSC didn't supply enough candidates.
  if (chosen.length < limit) {
    const taken = new Set(chosen.map((c) => c.id));
    for (const p of stale) {
      if (chosen.length >= limit) break;
      if (!taken.has(p.id)) chosen.push(p);
    }
  }
  return { posts: chosen, selection: "gsc-performance" };
}

export async function runContentRefresh(): Promise<RefreshResult> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("Missing ANTHROPIC_API_KEY");
  if (!hasSupabaseConfig) throw new Error("Missing Supabase config");

  const startedAt = Date.now();
  const supabase = getSupabase();

  const { posts: targets, selection } = await selectRefreshTargets(supabase, MAX_PER_RUN);

  if (targets.length === 0) {
    await sendTelegramMessage(
      "ℹ️ <b>Content Refresh:</b> No posts need refreshing yet (all updated within 30 days)."
    );
    return { success: true, skipped: true, reason: "nothing-stale" };
  }

  // Whole corpus once, reused as the internal-link pool for every post below.
  const { data: allPosts } = await supabase
    .from("blogs")
    .select("title, slug")
    .limit(2000);
  const corpus = (allPosts ?? []) as { title: string; slug: string }[];

  const client = getAnthropic();
  const refreshed: string[] = [];

  for (const post of targets) {
    if (Date.now() - startedAt > TIME_BUDGET_MS) {
      console.log(
        `[Content Refresh] Time budget reached after ${refreshed.length} post(s); stopping cleanly.`
      );
      break;
    }
    try {
      await refreshPost({ supabase, client, post, corpus });
      refreshed.push(post.slug);
    } catch (err) {
      // One failure shouldn't abort the batch — the posts already written
      // are committed, and the next run re-selects whatever is still stale.
      console.error(`[Content Refresh] Failed on ${post.slug}:`, err);
      await sendTelegramMessage(
        `⚠️ <b>Content Refresh — one post failed</b>\n\n` +
          `📝 ${post.title}\n` +
          `Error: ${err instanceof Error ? err.message : "unknown"}`
      );
    }
  }

  if (refreshed.length === 0) {
    return { success: true, skipped: true, reason: "all-attempts-failed" };
  }

  return {
    success: true,
    refreshed,
    count: refreshed.length,
    selection,
  };
}

async function refreshPost(opts: {
  supabase: ReturnType<typeof getSupabase>;
  client: ReturnType<typeof getAnthropic>;
  post: RefreshCandidate;
  corpus: { title: string; slug: string }[];
}): Promise<void> {
  const { supabase, client, post, corpus } = opts;

  // Internal links by topical relevance rather than recency, so refreshing an
  // older post can also surface other older posts on the same topic instead
  // of only pointing at last week's articles.
  const linkTargets = pickRelevantLinkTargets(
    `${post.title} ${post.keywords ?? ""}`,
    corpus.filter((c) => c.slug !== post.slug),
    6
  );
  const recentLinksInstruction = linkTargets
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
5. Add internal links to these related posts where relevant:
${recentLinksInstruction}
6. Also link to https://invoicetodata.com and https://invoicetodata.com/tools/pdf-to-excel where appropriate
7. Keep the ## FAQ section and add 1-2 new Q&As if possible
8. Make sure the content reads naturally and is genuinely helpful
9. Open the article with a **bolded 2-3 sentence direct answer** to the question implied by the title, before any heading. If one is already there, sharpen it. This is the block an AI summary quotes, so it has to stand alone.

CLAIMS DISCIPLINE:
- Do NOT invent statistics while "updating" them. If the existing article
  cites a figure you cannot stand behind, replace it with the mechanism or a
  worked example rather than swapping in a new invented number.
- Do NOT add unverifiable social proof ("thousands of businesses"). We don't
  have those numbers.

IMPORTANT:
- Output the FULL updated article in Markdown
- Do NOT include the title (I'll keep the original)
- Start directly with the content (the bolded answer, then ## Introduction)
- Keep all existing good content, just enhance it
- The total article should be 1800-3000 words`;

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
