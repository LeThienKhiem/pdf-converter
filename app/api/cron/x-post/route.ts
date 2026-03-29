import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getSupabase, hasSupabaseConfig } from "@/lib/supabase";
import { sendTelegramMessage } from "@/lib/telegram";
import crypto from "crypto";

/**
 * Vercel Cron Job — runs daily at 10:00 AM UTC (5:00 PM VN)
 * Auto-generates and posts engaging content to X (Twitter).
 * Content rotates between: tips, blog promotion, questions, stats, threads.
 * Each post links back to invoicetodata.com for organic traffic.
 */

const SITE_URL = "https://invoicetodata.com";
const GEMINI_MODEL = "gemini-flash-lite-latest";
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── OAuth 1.0a signing for X API v2 ───

function percentEncode(str: string): string {
  return encodeURIComponent(str).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

function generateOAuthSignature(
  method: string,
  url: string,
  params: Record<string, string>,
  consumerSecret: string,
  tokenSecret: string
): string {
  const sortedKeys = Object.keys(params).sort();
  const paramString = sortedKeys.map((k) => `${percentEncode(k)}=${percentEncode(params[k])}`).join("&");
  const baseString = `${method.toUpperCase()}&${percentEncode(url)}&${percentEncode(paramString)}`;
  const signingKey = `${percentEncode(consumerSecret)}&${percentEncode(tokenSecret)}`;
  return crypto.createHmac("sha1", signingKey).update(baseString).digest("base64");
}

function buildOAuthHeader(
  method: string,
  url: string,
  consumerKey: string,
  consumerSecret: string,
  accessToken: string,
  accessTokenSecret: string
): string {
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: crypto.randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: accessToken,
    oauth_version: "1.0",
  };

  const signature = generateOAuthSignature(method, url, oauthParams, consumerSecret, accessTokenSecret);
  oauthParams.oauth_signature = signature;

  const headerParts = Object.keys(oauthParams)
    .sort()
    .map((k) => `${percentEncode(k)}="${percentEncode(oauthParams[k])}"`)
    .join(", ");

  return `OAuth ${headerParts}`;
}

// ─── Post to X API v2 ───

async function postTweet(text: string): Promise<{ success: boolean; tweetId?: string; error?: string }> {
  const consumerKey = process.env.X_API_KEY;
  const consumerSecret = process.env.X_API_SECRET;
  const accessToken = process.env.X_ACCESS_TOKEN;
  const accessTokenSecret = process.env.X_ACCESS_TOKEN_SECRET;

  if (!consumerKey || !consumerSecret || !accessToken || !accessTokenSecret) {
    return { success: false, error: "Missing X API credentials" };
  }

  const url = "https://api.twitter.com/2/tweets";
  const authHeader = buildOAuthHeader("POST", url, consumerKey, consumerSecret, accessToken, accessTokenSecret);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(30000),
    });

    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: `X API ${res.status}: ${JSON.stringify(data).slice(0, 200)}` };
    }

    return { success: true, tweetId: data.data?.id };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ─── Content generation ───

async function callGeminiWithRetry(
  model: ReturnType<InstanceType<typeof GoogleGenerativeAI>["getGenerativeModel"]>,
  prompt: string
): Promise<string> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const isRetryable = msg.includes("429") || msg.includes("503") || msg.includes("RESOURCE_EXHAUSTED");
      if (isRetryable && attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAY_MS * attempt);
        continue;
      }
      throw err;
    }
  }
  throw new Error("Max retries exceeded");
}

// Content types — weighted so most posts are pure value, few have links
// ~70% no link (pure engagement), ~30% with link (traffic)
const CONTENT_TYPES = [
  {
    type: "tip",
    hasLink: false,
    prompt: `Write a single tweet (max 270 chars) sharing a practical, specific tip about invoice processing, accounting workflows, or financial data management.
NO links. NO hashtags. Just pure value that makes people want to bookmark or retweet.
Do NOT use quotes around the tweet. Output ONLY the tweet text.`,
  },
  {
    type: "hot_take",
    hasLink: false,
    prompt: `Write a single tweet (max 270 chars) with a spicy but defensible opinion about accounting, finance automation, or business operations.
Something that will make people reply with "This!" or argue in the comments.
NO links. NO hashtags. Be bold but not offensive.
Do NOT use quotes around the tweet. Output ONLY the tweet text.`,
  },
  {
    type: "question",
    hasLink: false,
    prompt: `Write a single tweet (max 270 chars) asking a genuinely interesting question about how people handle invoices, accounting, or financial data.
The question should be easy to answer and make people want to share their experience.
NO links. NO hashtags. Just the question.
Do NOT use quotes around the tweet. Output ONLY the tweet text.`,
  },
  {
    type: "story",
    hasLink: false,
    prompt: `Write a single tweet (max 270 chars) telling a very short relatable story or observation about office/accounting life.
Something like "The moment you realize you've been manually copying the same 50 invoices every month for 3 years..."
Make it funny or painfully relatable. NO links. NO hashtags.
Do NOT use quotes around the tweet. Output ONLY the tweet text.`,
  },
  {
    type: "stat",
    hasLink: false,
    prompt: `Write a single tweet (max 270 chars) sharing a surprising real statistic about:
- Time wasted on manual data entry in finance
- Invoice processing costs for businesses
- Error rates in manual accounting
- How much time automation saves

Share the stat and add a brief personal take. NO links. NO hashtags.
Do NOT use quotes around the tweet. Output ONLY the tweet text.`,
  },
  {
    type: "listicle",
    hasLink: false,
    prompt: `Write a single tweet (max 270 chars) with a mini list of 3 things.
Topics: productivity tips for accountants, signs your invoicing process is broken, things people get wrong about data entry, or unpopular opinions about finance tools.
Format like "3 signs your invoice process needs fixing:" then brief points.
NO links. NO hashtags.
Do NOT use quotes around the tweet. Output ONLY the tweet text.`,
  },
  {
    type: "blog_promo",
    hasLink: true,
    prompt: `BLOG_POST_PLACEHOLDER
Write a single tweet (max 270 chars) sharing the most interesting insight from this blog post.
Lead with the insight, NOT "we wrote a blog post". The link should feel like a natural addition, not the point of the tweet.
Include the blog URL. NO hashtags.
Do NOT use quotes around the tweet. Output ONLY the tweet text.`,
  },
  {
    type: "before_after",
    hasLink: true,
    prompt: `Write a single tweet (max 270 chars) showing a quick before/after of manual vs automated invoice processing.
Keep it concrete and specific, not vague.
Use format:
Before: [specific pain]
After: [specific result]

Include ${SITE_URL} naturally at the end. NO hashtags.
Do NOT use quotes around the tweet. Output ONLY the tweet text.`,
  },
  {
    type: "product_subtle",
    hasLink: true,
    prompt: `Write a single tweet (max 270 chars) that shares a genuine insight about invoice processing or data extraction, and naturally mentions that you built a tool for this.
The tweet should be 80% insight, 20% product mention.
Include ${SITE_URL} at the end. NO hashtags. Write in first person.
Do NOT use quotes around the tweet. Output ONLY the tweet text.`,
  },
];

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("Missing GEMINI_API_KEY");

    // Random delay 0-90 minutes so post time varies each day (anti-bot detection)
    const randomDelayMs = Math.floor(Math.random() * 90 * 60 * 1000);
    if (randomDelayMs > 0) {
      await sleep(Math.min(randomDelayMs, 30000)); // Cap at 30s in serverless (Vercel timeout)
    }

    // Pick content type based on day of year — shuffled to feel random
    const dayOfYear = Math.floor(
      (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
    );
    // Use a prime multiplier to avoid predictable rotation pattern
    const shuffledIndex = (dayOfYear * 7 + 3) % CONTENT_TYPES.length;
    const contentType = CONTENT_TYPES[shuffledIndex];

    let prompt = contentType.prompt;

    // If blog_promo, fetch latest blog post
    if (contentType.type === "blog_promo" && hasSupabaseConfig) {
      const supabase = getSupabase();
      const { data: latestPost } = await supabase
        .from("blogs")
        .select("title, slug, meta_description, keywords")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (latestPost) {
        const blogInfo = `Blog post title: "${latestPost.title}"
URL: ${SITE_URL}/blog/${latestPost.slug}
Description: ${latestPost.meta_description ?? ""}
Keywords: ${latestPost.keywords ?? ""}`;
        prompt = prompt.replace("BLOG_POST_PLACEHOLDER", blogInfo);
      } else {
        // Fallback to tip if no blog post
        prompt = CONTENT_TYPES[0].prompt;
      }
    } else {
      prompt = prompt.replace("BLOG_POST_PLACEHOLDER\n", "");
    }

    // Generate tweet with Gemini
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

    const fullPrompt = `You are the social media manager for InvoiceToData (${SITE_URL}), an AI-powered invoice OCR tool.
Your X account has 70k followers — mostly finance/accounting professionals, developers, and SMB owners.

${prompt}

CRITICAL QUALITY RULES FOR HIGH ENGAGEMENT:
- Max 280 characters total (URLs count as 23 characters)
- Write like a real human sharing genuine insights — NOT a brand account
- NO corporate buzzwords ("leverage", "synergy", "empower", "unlock", "game-changer")
- NO generic filler phrases ("In today's fast-paced world", "As we all know")
- Start with a HOOK: a bold opinion, surprising number, or relatable frustration
- Be specific — use real numbers, real scenarios, real pain points
- Use conversational tone as if talking to a colleague
- Max 1-2 emojis (or zero — many top posts have no emojis)
- Max 1 hashtag (or zero — organic reach is better without hashtag spam)
- If linking to the product, make the value obvious BEFORE the link
- Avoid sounding like an ad. If someone can tell it's automated, it's bad.
- Study the tone of popular fintech/SaaS founders on X — be opinionated, concise, useful
- Posts that teach ONE specific thing always outperform promotional posts

EXAMPLES OF GOOD TONE:
- "We processed 10,000 invoices last month. The #1 error? Wrong totals from manual entry. Every single time."
- "Hot take: if you're still copying invoice data into spreadsheets by hand in 2026, you're leaving money on the table."
- "Accountants don't need more tools. They need fewer steps between 'receive invoice' and 'data in spreadsheet'."

EXAMPLES OF BAD TONE (never do this):
- "Excited to announce our amazing new feature! 🚀🎉 #AI #OCR #SaaS #Fintech"
- "Transform your invoice processing workflow with our cutting-edge AI solution!"
- "Did you know that AI can help with invoice processing? Learn more at..."

Output ONLY the tweet text. No quotes, no labels, no explanations.`;

    let tweetText = await callGeminiWithRetry(model, fullPrompt);

    // Clean up: remove quotes if Gemini wrapped it
    tweetText = tweetText.trim().replace(/^["']|["']$/g, "").trim();

    // Ensure tweet is under 280 chars
    if (tweetText.length > 280) {
      tweetText = tweetText.substring(0, 277) + "...";
    }

    // Post to X
    const result = await postTweet(tweetText);

    // Notify via Telegram
    const statusEmoji = result.success ? "✅" : "❌";
    const tweetUrl = result.tweetId ? `https://x.com/i/status/${result.tweetId}` : "N/A";

    const msg = `${statusEmoji} <b>X Post ${result.success ? "Published" : "Failed"}</b>

📝 Type: ${contentType.type}
💬 Content:
<i>${tweetText.slice(0, 500)}</i>

${result.success ? `🔗 <a href="${tweetUrl}">View Tweet</a>` : `❌ Error: ${result.error?.slice(0, 200)}`}

📊 Scheduled: daily 10:00 AM UTC`;

    await sendTelegramMessage(msg);

    return NextResponse.json({
      success: result.success,
      type: contentType.type,
      tweet: tweetText,
      tweetId: result.tweetId,
      error: result.error,
    });
  } catch (err) {
    console.error("[X Post Cron] Error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    await sendTelegramMessage(`❌ <b>X Post Cron Failed</b>\n\nError: ${message}`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
