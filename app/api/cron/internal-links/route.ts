import { NextResponse } from "next/server";
import { getSupabase, hasSupabaseConfig } from "@/lib/supabase";
import { sendTelegramMessage } from "@/lib/telegram";

/**
 * Vercel Cron Job — runs weekly (Saturday 4:00 AM UTC)
 * Automatically scans all blog posts and adds internal links between
 * related posts. Internal linking is one of the most effective on-page
 * SEO techniques — it helps Google discover pages and distributes
 * page authority across the site.
 */

const SITE_URL = "https://invoicetodata.com";

// Core pages that should be linked from every post
const CORE_LINKS: { url: string; anchors: string[] }[] = [
  {
    url: `${SITE_URL}/tools/pdf-to-excel`,
    anchors: ["PDF to Excel", "convert PDF to Excel", "PDF to Excel converter", "invoice to Excel"],
  },
  {
    url: `${SITE_URL}/tools/pdf-to-gsheet`,
    anchors: ["PDF to Google Sheets", "convert PDF to Google Sheets", "PDF to Sheets"],
  },
  {
    url: SITE_URL,
    anchors: ["InvoiceToData", "invoice data extraction tool", "invoice OCR tool"],
  },
];

type BlogPost = {
  id: string;
  title: string;
  slug: string;
  content: string;
  keywords: string | null;
};

/** Extract key topics from title + keywords for matching */
function extractTopics(post: BlogPost): string[] {
  const text = `${post.title} ${post.keywords ?? ""}`.toLowerCase();
  const topics: string[] = [];

  const topicMap: Record<string, string[]> = {
    ocr: ["ocr", "optical character"],
    invoice: ["invoice", "invoicing"],
    comparison: ["vs", "versus", "compare", "comparison", "alternative"],
    automation: ["automat", "workflow", "efficiency"],
    accounting: ["account", "bookkeep", "financial"],
    excel: ["excel", "spreadsheet", "xlsx"],
    "small-business": ["small business", "smb", "startup", "freelance"],
    healthcare: ["healthcare", "medical", "clinic"],
    construction: ["construction", "contractor"],
    ecommerce: ["ecommerce", "e-commerce", "online store", "shopify"],
    "data-extraction": ["data extraction", "extract data", "parse", "parser"],
    pdf: ["pdf", "document"],
  };

  for (const [topic, keywords] of Object.entries(topicMap)) {
    if (keywords.some((kw) => text.includes(kw))) {
      topics.push(topic);
    }
  }

  return topics;
}

/** Find related posts based on topic overlap */
function findRelatedPosts(
  currentPost: BlogPost,
  allPosts: BlogPost[]
): BlogPost[] {
  const currentTopics = extractTopics(currentPost);
  const scored = allPosts
    .filter((p) => p.id !== currentPost.id)
    .map((p) => {
      const pTopics = extractTopics(p);
      const overlap = currentTopics.filter((t) => pTopics.includes(t)).length;
      return { post: p, score: overlap };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, 3).map((s) => s.post);
}

/** Check if content already contains a link to a URL */
function hasLinkTo(content: string, url: string): boolean {
  return content.includes(url);
}

/** Add a "Related Articles" section at the bottom if not present */
function addRelatedSection(
  content: string,
  relatedPosts: BlogPost[]
): string {
  if (relatedPosts.length === 0) return content;

  // Check if already has a related section
  if (content.includes("## Related") || content.includes("## Further Reading")) {
    return content;
  }

  const relatedLinks = relatedPosts
    .map((p) => `- [${p.title}](${SITE_URL}/blog/${p.slug})`)
    .join("\n");

  return `${content.trimEnd()}

## Related Articles

${relatedLinks}
`;
}

/** Add core page links if missing from content */
function addCoreLinkIfMissing(content: string): { content: string; added: number } {
  let updated = content;
  let added = 0;

  for (const coreLink of CORE_LINKS) {
    if (hasLinkTo(updated, coreLink.url)) continue;

    // Try to find a mention of any anchor text and convert it to a link
    for (const anchor of coreLink.anchors) {
      const anchorLower = anchor.toLowerCase();
      // Use regex to find unlinked mentions (not already inside []() markdown link)
      const regex = new RegExp(
        `(?<![\\[\\(])\\b(${anchor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})\\b(?![\\]\\)])`,
        "i"
      );
      const match = updated.match(regex);
      if (match && match.index !== undefined) {
        // Only link the first occurrence
        const original = match[1];
        updated =
          updated.slice(0, match.index) +
          `[${original}](${coreLink.url})` +
          updated.slice(match.index + original.length);
        added++;
        break; // Only add one link per core page
      }
    }
  }

  return { content: updated, added };
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    if (!hasSupabaseConfig) throw new Error("Missing Supabase config");

    const supabase = getSupabase();

    // Get all blog posts
    const { data: allPosts, error: fetchError } = await supabase
      .from("blogs")
      .select("id, title, slug, content, keywords")
      .order("created_at", { ascending: false });

    if (fetchError) throw new Error(`Fetch failed: ${fetchError.message}`);
    if (!allPosts || allPosts.length < 2) {
      return NextResponse.json({ success: true, message: "Not enough posts for interlinking" });
    }

    const posts = allPosts as BlogPost[];
    let totalLinksAdded = 0;
    let postsUpdated = 0;
    const updatedSlugs: string[] = [];

    for (const post of posts) {
      let modified = false;
      let updatedContent = post.content;

      // 1. Add core page links if missing
      const coreResult = addCoreLinkIfMissing(updatedContent);
      if (coreResult.added > 0) {
        updatedContent = coreResult.content;
        totalLinksAdded += coreResult.added;
        modified = true;
      }

      // 2. Add related articles section if missing
      const relatedPosts = findRelatedPosts(post, posts);
      const newRelatedPosts = relatedPosts.filter(
        (rp) => !hasLinkTo(updatedContent, `${SITE_URL}/blog/${rp.slug}`)
      );

      if (newRelatedPosts.length > 0) {
        updatedContent = addRelatedSection(updatedContent, newRelatedPosts);
        totalLinksAdded += newRelatedPosts.length;
        modified = true;
      }

      // 3. Save if modified
      if (modified) {
        const { error: updateError } = await supabase
          .from("blogs")
          .update({ content: updatedContent })
          .eq("id", post.id);

        if (!updateError) {
          postsUpdated++;
          updatedSlugs.push(post.slug);
        }
      }
    }

    // Notify via Telegram
    const msg = `🔗 <b>Internal Linking Report</b>

📊 <b>Results</b>
• Total posts scanned: ${posts.length}
• Posts updated: ${postsUpdated}
• New links added: ${totalLinksAdded}

${updatedSlugs.length > 0
  ? `📝 <b>Updated posts:</b>\n${updatedSlugs.slice(0, 10).map((s) => `• ${s}`).join("\n")}`
  : "✅ All posts already have good internal linking!"}`;

    await sendTelegramMessage(msg);

    return NextResponse.json({
      success: true,
      postsScanned: posts.length,
      postsUpdated,
      totalLinksAdded,
    });
  } catch (err) {
    console.error("[Internal Links Cron] Error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    await sendTelegramMessage(`❌ <b>Internal Links Cron Failed</b>\n\nError: ${message}`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
