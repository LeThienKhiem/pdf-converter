import { NextResponse } from "next/server";
import { getSupabase, hasSupabaseConfig } from "@/lib/supabase";
import { sendTelegramMessage } from "@/lib/telegram";
import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * Cron: Optimize meta titles & descriptions for blog posts with low CTR.
 * Runs weekly on Tuesday at 3AM UTC.
 * Uses Gemini AI to rewrite meta descriptions to be more click-worthy
 * while keeping them under 160 chars with power words and CTAs.
 */

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? "");

export async function GET(req: Request) {
  // Verify cron secret
  const authHeader = req.headers.get("authorization");
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasSupabaseConfig) {
    return NextResponse.json({ error: "No Supabase config" }, { status: 500 });
  }

  try {
    const supabase = getSupabase();

    // Get all blog posts ordered by created_at (newest first)
    const { data: posts, error } = await supabase
      .from("blogs")
      .select("id, title, slug, meta_description, keywords")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error || !posts || posts.length === 0) {
      return NextResponse.json({ message: "No posts found" });
    }

    // Find posts with weak meta descriptions (too short, no CTA, generic)
    const postsToOptimize = posts.filter((p: { meta_description: string | null }) => {
      const desc = p.meta_description ?? "";
      // Needs optimization if:
      // - No meta description
      // - Too short (< 80 chars) or too long (> 160 chars)
      // - Missing power words / CTA
      const hasNoPowerWords = !/(free|save|fast|easy|instant|step|guide|how to|best|top|quick|simple|automate)/i.test(desc);
      const hasCTA = /(try|start|learn|discover|get|download|convert|extract)/i.test(desc);
      return (
        desc.length < 80 ||
        desc.length > 165 ||
        (hasNoPowerWords && !hasCTA)
      );
    });

    // Limit to 5 per run to avoid rate limits
    const batch = postsToOptimize.slice(0, 5);

    if (batch.length === 0) {
      await sendTelegramMessage("Meta Optimizer: All posts already have optimized meta descriptions.");
      return NextResponse.json({ message: "All posts optimized" });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite" });
    const updated: string[] = [];

    for (const post of batch) {
      const typedPost = post as { id: string; title: string; slug: string; meta_description: string | null; keywords: string | null };
      const prompt = `You are an SEO expert. Rewrite the meta description for this blog post to maximize click-through rate from Google Search results.

Blog title: "${typedPost.title}"
Current meta description: "${typedPost.meta_description ?? "none"}"
Keywords: "${typedPost.keywords ?? ""}"

RULES:
- MUST be 120-155 characters (this is critical for Google display)
- Start with a hook or number (e.g. "Learn 5 ways..." or "Save hours...")
- Include primary keyword naturally in first 60 chars
- End with a subtle CTA (e.g. "Free guide inside", "Step-by-step tutorial", "Try free today")
- Use power words: free, easy, fast, save, automate, instant, step-by-step, guide, best
- Sound helpful and actionable, NOT salesy or spammy
- Write in English

Return ONLY the new meta description text, nothing else.`;

      try {
        const result = await model.generateContent(prompt);
        const newDesc = result.response.text().trim().replace(/^["']|["']$/g, "");

        if (newDesc.length >= 80 && newDesc.length <= 165) {
          const { error: updateErr } = await supabase
            .from("blogs")
            .update({ meta_description: newDesc })
            .eq("id", typedPost.id);

          if (!updateErr) {
            updated.push(`${typedPost.title}\n  OLD: ${typedPost.meta_description?.slice(0, 80) ?? "none"}...\n  NEW: ${newDesc}`);
          }
        }
      } catch {
        // Skip this post if AI fails
        continue;
      }
    }

    // Also optimize titles that are too long (> 60 chars) or too short
    const titleBatch = posts
      .filter((p: { title: string }) => p.title.length > 65 || p.title.length < 20)
      .slice(0, 3);

    for (const post of titleBatch) {
      const typedPost = post as { id: string; title: string; slug: string; keywords: string | null };
      const prompt = `You are an SEO expert. Rewrite this blog post title for better Google Search CTR.

Current title: "${typedPost.title}"
Keywords: "${typedPost.keywords ?? ""}"

RULES:
- MUST be 50-60 characters (critical for Google display, do NOT exceed 60)
- Include primary keyword in first 40 chars
- Use power words: Free, Best, Guide, How to, Easy, Fast, Step-by-Step
- Make it specific and actionable
- Write in English

Return ONLY the new title text, nothing else.`;

      try {
        const result = await model.generateContent(prompt);
        const newTitle = result.response.text().trim().replace(/^["']|["']$/g, "");

        if (newTitle.length >= 30 && newTitle.length <= 65) {
          const { error: updateErr } = await supabase
            .from("blogs")
            .update({ title: newTitle })
            .eq("id", typedPost.id);

          if (!updateErr) {
            updated.push(`TITLE: ${typedPost.title} → ${newTitle}`);
          }
        }
      } catch {
        continue;
      }
    }

    const report = updated.length > 0
      ? `Meta Optimizer: Updated ${updated.length} posts\n\n${updated.join("\n\n")}`
      : "Meta Optimizer: No updates needed this run.";

    await sendTelegramMessage(report);

    return NextResponse.json({
      success: true,
      optimized: updated.length,
      details: updated,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await sendTelegramMessage(`Meta Optimizer ERROR: ${msg}`);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
