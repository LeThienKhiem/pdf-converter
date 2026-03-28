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

// Content types that rotate daily
const CONTENT_TYPES = [
  {
    type: "tip",
    prompt: `Write a single tweet (max 270 chars) sharing a practical tip about invoice processing, data extraction, or accounting automation.
The tone should be helpful and professional. Include 1-2 relevant hashtags.
End with a subtle CTA like "Try it free →" linking to ${SITE_URL}
Do NOT use quotes around the tweet. Output ONLY the tweet text.`,
  },
  {
    type: "blog_promo",
    prompt: `BLOG_POST_PLACEHOLDER
Write a single tweet (max 270 chars) promoting this blog post. Extract the most interesting insight or stat.
Make it engaging — start with a hook, not "Check out our latest post".
Include the blog URL and 1-2 hashtags.
Do NOT use quotes around the tweet. Output ONLY the tweet text.`,
  },
  {
    type: "question",
    prompt: `Write a single tweet (max 270 chars) asking an engaging question about invoice processing, PDF data extraction, or accounting workflows.
The question should spark discussion and be relevant to finance/accounting professionals.
Include 1-2 relevant hashtags. Do NOT include any links.
Do NOT use quotes around the tweet. Output ONLY the tweet text.`,
  },
  {
    type: "stat",
    prompt: `Write a single tweet (max 270 chars) sharing a surprising or compelling statistic about:
- Time wasted on manual data entry
- Invoice processing costs
- Error rates in manual accounting
- AI/OCR adoption in finance

The stat should be realistic and citable. End with a brief comment and 1-2 hashtags.
Include a link to ${SITE_URL} as the solution.
Do NOT use quotes around the tweet. Output ONLY the tweet text.`,
  },
  {
    type: "before_after",
    prompt: `Write a single tweet (max 270 chars) showing a before/after comparison:
Before: manual invoice processing pain point
After: using AI OCR automation

Use a simple format like:
❌ Before: [pain]
✅ After: [benefit]

Include link to ${SITE_URL} and 1-2 hashtags.
Do NOT use quotes around the tweet. Output ONLY the tweet text.`,
  },
  {
    type: "thread_hook",
    prompt: `Write a single tweet (max 270 chars) that's a compelling hook for a thread about invoice automation or PDF data extraction.
Start with "🧵" to indicate it's a thread opener.
Make it attention-grabbing — use numbers, a bold claim, or a relatable pain point.
End with "↓" to indicate more below.
Include 1-2 hashtags.
Do NOT use quotes around the tweet. Output ONLY the tweet text.`,
  },
  {
    type: "product_feature",
    prompt: `Write a single tweet (max 270 chars) highlighting ONE specific feature of InvoiceToData:
- AI OCR that reads scanned invoices
- Instant PDF to Excel conversion
- PDF to Google Sheets export
- No data stored (privacy-first)
- Free to use
- Handles any invoice format

Make it benefit-focused, not feature-focused. Include link to ${SITE_URL} and 1-2 hashtags.
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

    // Pick content type based on day of year
    const dayOfYear = Math.floor(
      (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
    );
    const contentType = CONTENT_TYPES[dayOfYear % CONTENT_TYPES.length];

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
