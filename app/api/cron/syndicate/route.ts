import { NextResponse } from "next/server";
import { getSupabase, hasSupabaseConfig } from "@/lib/supabase";
import { sendTelegramMessage } from "@/lib/telegram";

/**
 * Vercel Cron Job — runs daily at 5:00 AM UTC
 * Auto-syndicates blog posts to dev.to and Hashnode.
 * Each syndicated post uses a canonical_url pointing back to invoicetodata.com,
 * so Google knows the original source and gives SEO credit to our site.
 *
 * This creates FREE backlinks from high-authority domains (dev.to DA 60+, Hashnode DA 70+).
 */

const SITE_URL = "https://invoicetodata.com";

/** Post article to dev.to via their API */
async function postToDevTo(
  title: string,
  content: string,
  slug: string,
  tags: string[]
): Promise<{ success: boolean; url?: string; error?: string }> {
  const apiKey = process.env.DEVTO_API_KEY;
  if (!apiKey) return { success: false, error: "Missing DEVTO_API_KEY" };

  try {
    // Clean up content: remove internal links that won't make sense on dev.to
    const cleanContent = content
      // Add canonical notice at the top
      .replace(
        /^/,
        `*Originally published at [InvoiceToData Blog](${SITE_URL}/blog/${slug})*\n\n---\n\n`
      );

    // Map keywords to dev.to tags (max 4, lowercase, no spaces)
    const devtoTags = tags
      .slice(0, 4)
      .map((t) => t.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 30))
      .filter((t) => t.length > 0);

    const res = await fetch("https://dev.to/api/articles", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify({
        article: {
          title,
          body_markdown: cleanContent,
          published: true,
          canonical_url: `${SITE_URL}/blog/${slug}`,
          tags: devtoTags.length > 0 ? devtoTags : ["ai", "saas", "productivity"],
          description: `Learn about ${title.toLowerCase()} - from InvoiceToData`,
        },
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      const errText = await res.text();
      return { success: false, error: `dev.to ${res.status}: ${errText.slice(0, 200)}` };
    }

    const data = await res.json();
    return { success: true, url: data.url };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Post article to Hashnode via GraphQL API */
async function postToHashnode(
  title: string,
  content: string,
  slug: string,
  tags: string[]
): Promise<{ success: boolean; url?: string; error?: string }> {
  const apiKey = process.env.HASHNODE_API_KEY;
  const publicationId = process.env.HASHNODE_PUBLICATION_ID;
  if (!apiKey || !publicationId) return { success: false, error: "Missing HASHNODE_API_KEY or HASHNODE_PUBLICATION_ID" };

  try {
    // Add canonical notice
    const cleanContent = `*Originally published at [InvoiceToData Blog](${SITE_URL}/blog/${slug})*\n\n---\n\n${content}`;

    // Hashnode tags (use predefined popular tags)
    const tagMap: Record<string, string> = {
      ai: "artificial-intelligence",
      ocr: "machine-learning",
      invoice: "saas",
      automation: "automation",
      excel: "productivity",
      pdf: "tools",
      accounting: "fintech",
      saas: "saas",
    };

    const hashnodeTags = tags
      .map((t) => tagMap[t.toLowerCase().trim()] ?? null)
      .filter((t): t is string => t !== null)
      .slice(0, 5)
      .map((t) => ({ slug: t, name: t }));

    const mutation = `
      mutation PublishPost($input: PublishPostInput!) {
        publishPost(input: $input) {
          post {
            url
            slug
          }
        }
      }
    `;

    const res = await fetch("https://gql.hashnode.com", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: apiKey,
      },
      body: JSON.stringify({
        query: mutation,
        variables: {
          input: {
            title,
            contentMarkdown: cleanContent,
            publicationId,
            slug: slug.slice(0, 250),
            tags: hashnodeTags.length > 0 ? hashnodeTags : [{ slug: "saas", name: "saas" }],
            originalArticleURL: `${SITE_URL}/blog/${slug}`,
            disableComments: false,
          },
        },
      }),
      signal: AbortSignal.timeout(30000),
    });

    const data = await res.json();
    if (data.errors) {
      return { success: false, error: data.errors[0]?.message ?? "Unknown Hashnode error" };
    }

    const postUrl = data.data?.publishPost?.post?.url;
    return { success: true, url: postUrl ?? undefined };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Post to Medium via API */
async function postToMedium(
  title: string,
  content: string,
  slug: string,
  tags: string[]
): Promise<{ success: boolean; url?: string; error?: string }> {
  const token = process.env.MEDIUM_API_TOKEN;
  if (!token) return { success: false, error: "Missing MEDIUM_API_TOKEN" };

  try {
    // First get user ID
    const userRes = await fetch("https://api.medium.com/v1/me", {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15000),
    });
    const userData = await userRes.json();
    const userId = userData.data?.id;
    if (!userId) return { success: false, error: "Could not get Medium user ID" };

    // Add canonical notice
    const cleanContent = `*Originally published at [InvoiceToData Blog](${SITE_URL}/blog/${slug})*\n\n---\n\n${content}`;

    const res = await fetch(`https://api.medium.com/v1/users/${userId}/posts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        title,
        contentFormat: "markdown",
        content: cleanContent,
        canonicalUrl: `${SITE_URL}/blog/${slug}`,
        tags: tags.slice(0, 5),
        publishStatus: "public",
      }),
      signal: AbortSignal.timeout(30000),
    });

    const data = await res.json();
    if (data.errors) {
      return { success: false, error: data.errors[0]?.message ?? "Unknown Medium error" };
    }

    return { success: true, url: data.data?.url ?? undefined };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
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

    // Find the latest blog post that hasn't been syndicated yet
    // We use a simple approach: check if we syndicated in the last 24h
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recentPosts } = await supabase
      .from("blogs")
      .select("id, title, slug, content, keywords, created_at")
      .gte("created_at", oneDayAgo)
      .order("created_at", { ascending: false })
      .limit(1);

    if (!recentPosts || recentPosts.length === 0) {
      return NextResponse.json({ success: true, message: "No new posts to syndicate" });
    }

    const post = recentPosts[0];
    const tags = (post.keywords ?? "invoice OCR, data extraction")
      .split(",")
      .map((t: string) => t.trim())
      .filter(Boolean);

    // Syndicate to all platforms in parallel
    const [devtoResult, hashnodeResult, mediumResult] = await Promise.all([
      postToDevTo(post.title, post.content, post.slug, tags),
      postToHashnode(post.title, post.content, post.slug, tags),
      postToMedium(post.title, post.content, post.slug, tags),
    ]);

    // Build Telegram report
    const results = [
      { name: "dev.to", ...devtoResult },
      { name: "Hashnode", ...hashnodeResult },
      { name: "Medium", ...mediumResult },
    ];

    const successCount = results.filter((r) => r.success).length;
    const report = `📢 <b>Content Syndication Report</b>

📝 <b>${post.title}</b>

${results
  .map((r) => {
    if (r.success) {
      return `✅ <b>${r.name}</b>: <a href="${r.url}">Published</a>`;
    }
    return `${r.error?.includes("Missing") ? "⏭️" : "❌"} <b>${r.name}</b>: ${r.error?.slice(0, 100)}`;
  })
  .join("\n")}

🔗 ${successCount} backlink(s) created with canonical URL → ${SITE_URL}/blog/${post.slug}
${successCount === 0 ? "\n💡 Add API keys to enable: DEVTO_API_KEY, HASHNODE_API_KEY, MEDIUM_API_TOKEN" : ""}`;

    await sendTelegramMessage(report);

    return NextResponse.json({
      success: true,
      post: post.slug,
      devto: devtoResult,
      hashnode: hashnodeResult,
      medium: mediumResult,
    });
  } catch (err) {
    console.error("[Syndicate Cron] Error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    await sendTelegramMessage(`❌ <b>Syndication Cron Failed</b>\n\nError: ${message}`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
