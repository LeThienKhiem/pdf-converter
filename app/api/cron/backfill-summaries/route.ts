import { NextResponse } from "next/server";
import { getSupabase, hasSupabaseConfig } from "@/lib/supabase";
import { getAnthropic } from "@/lib/anthropic";
import { summarizeExistingPost } from "@/lib/seoContent";
import { sendTelegramMessage } from "@/lib/telegram";

/**
 * One-shot (idempotent) backfill — populates the new `blogs.summary` column for
 * legacy posts so the Layer 1 dedup gate has compact corpus snapshots to work
 * with.
 *
 * Why batched: Vercel hobby/pro have a 60-300s function ceiling. We process at
 * most BATCH_SIZE posts per call so a hung Anthropic request can't kill the
 * whole job. Re-invoke until `remaining` reports 0; that's the "done" signal.
 *
 * Cost: ~$0.0003 per post on Haiku. 30 posts = ~$0.01 total, one-time.
 *
 * Usage:
 *   curl -H "Authorization: Bearer $CRON_SECRET" \
 *     https://invoicetodata.com/api/cron/backfill-summaries
 *
 * Safe to leave as a low-frequency cron (e.g. weekly) — once everything is
 * backfilled it returns immediately without any Anthropic calls.
 */

const BATCH_SIZE = 5;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error("Missing ANTHROPIC_API_KEY");
    if (!hasSupabaseConfig) throw new Error("Missing Supabase config");

    const supabase = getSupabase();

    // Pull a small batch of un-summarized posts. Oldest first so the corpus
    // gets coverage in chronological order — useful if a later run partial-
    // fails halfway through.
    const { data: posts, error: fetchErr } = await supabase
      .from("blogs")
      .select("id, title, content")
      .is("summary", null)
      .order("created_at", { ascending: true })
      .limit(BATCH_SIZE);

    if (fetchErr) throw new Error(`Supabase fetch failed: ${fetchErr.message}`);

    if (!posts || posts.length === 0) {
      // Backfill complete — exit fast with no API calls.
      return NextResponse.json({
        success: true,
        processed: 0,
        remaining: 0,
        message: "All posts already have summaries.",
      });
    }

    // Get remaining count for telemetry (cheap COUNT, not full select).
    const { count: remainingBefore } = await supabase
      .from("blogs")
      .select("id", { count: "exact", head: true })
      .is("summary", null);

    const client = getAnthropic();
    const results: { id: string; ok: boolean; error?: string }[] = [];

    // Sequential, not parallel: keeps Anthropic tier-1 rate limits happy and
    // prevents one bad row from spawning 5 retries simultaneously.
    for (const post of posts) {
      try {
        const summary = await summarizeExistingPost({
          title: post.title,
          content: post.content ?? "",
          client,
        });

        const { error: updateErr } = await supabase
          .from("blogs")
          .update({ summary })
          .eq("id", post.id);

        if (updateErr) throw new Error(updateErr.message);
        results.push({ id: post.id, ok: true });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        console.error(`[Backfill] Failed for post ${post.id}:`, message);
        results.push({ id: post.id, ok: false, error: message });
        // Don't bail — keep processing the rest of the batch so a single bad
        // post doesn't block backfill progress.
      }
    }

    const okCount = results.filter((r) => r.ok).length;
    const failCount = results.length - okCount;
    const remainingAfter = Math.max((remainingBefore ?? 0) - okCount, 0);

    // Only ping Telegram on the final batch or on errors — avoid notification
    // spam during normal backfill progress.
    if (remainingAfter === 0 || failCount > 0) {
      const status = failCount === 0 ? "✅" : "⚠️";
      await sendTelegramMessage(
        `${status} <b>Blog Summary Backfill</b>\n\n` +
          `Batch processed: ${okCount} ok, ${failCount} failed\n` +
          `Remaining without summary: ${remainingAfter}\n` +
          (remainingAfter === 0 ? "🎉 Backfill complete." : "Re-invoke to continue.")
      );
    }

    return NextResponse.json({
      success: true,
      processed: okCount,
      failed: failCount,
      remaining: remainingAfter,
      results,
    });
  } catch (err) {
    console.error("[Backfill Summaries] Error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    await sendTelegramMessage(
      `❌ <b>Blog Summary Backfill Failed</b>\n\nError: ${message}`
    );
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
