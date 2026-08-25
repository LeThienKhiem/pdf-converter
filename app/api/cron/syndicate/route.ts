import { NextResponse } from "next/server";
import { getSupabase, hasSupabaseConfig } from "@/lib/supabase";
import { sendTelegramMessage } from "@/lib/telegram";

/**
 * Vercel Cron Job — runs daily at 5:00 AM UTC
 * Auto-syndicates blog posts to dev.to and Hashnode with a canonical URL.
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
        Accept: "application/json",
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

    // The endpoint sometimes answers a POST with the Hashnode web app's HTML
    // instead of GraphQL JSON — seen consistently from one dev machine whose
    // IP is also flagged by Google's bot detection, so it reads as an edge or
    // reputation block rather than a bad request. Parsing that as JSON throws
    // "Unexpected token '<'", which says nothing useful at 5am in a Telegram
    // alert. Detect it and name it instead.
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("json")) {
      const preview = (await res.text()).slice(0, 80).replace(/\s+/g, " ");
      return {
        success: false,
        error: `Hashnode returned ${res.status} ${contentType || "no content-type"} instead of JSON (likely an edge/reputation block on the caller's IP, not a bad request). Body starts: ${preview}`,
      };
    }

    const data = await res.json();
    if (data.errors) {
      return { success: false, error: data.errors[0]?.message ?? "Unknown Hashnode error" };
    }

    const postUrl = data.data?.publishPost?.post?.url;
    if (!postUrl) {
      return { success: false, error: "Hashnode accepted the request but returned no post URL" };
    }
    return { success: true, url: postUrl };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

type Platform = "devto" | "hashnode" | "medium";

/**
 * Platforms in the daily rotation.
 *
 * Medium is deliberately absent. It retired the Integration Token programme,
 * so api.medium.com no longer issues new tokens — the code path could only
 * ever report a failure. Left in the CHECK constraint on blog_syndications
 * (harmlessly) in case the API returns, but out of the rotation so the daily
 * report isn't carrying a permanent error line that trains you to ignore it.
 *
 * Not padding this list back to three. The remaining options with real
 * publishing APIs are low-authority, and a burst of links from weak domains on
 * a six-month-old site is the footprint worth avoiding — the same reason we
 * aren't scripting directory submissions. Two good platforms beats five weak
 * ones.
 */
const PLATFORMS: {
  key: Platform;
  label: string;
  post: (title: string, content: string, slug: string, tags: string[]) => Promise<{ success: boolean; url?: string; error?: string }>;
}[] = [
  { key: "devto", label: "dev.to", post: postToDevTo },
  { key: "hashnode", label: "Hashnode", post: postToHashnode },
];

export type SyndicateResult =
  | { success: true; slug: string; published: number; retried: number; remaining: number }
  | { success: true; skipped: true; reason: string }
  | {
      success: true;
      dryRun: true;
      slug: string;
      title: string;
      impressions: number;
      wouldPostTo: string[];
      alreadyDone: string[];
      remaining: number;
      queuePreview: { slug: string; impressions: number }[];
    };

/**
 * Syndicate one post per run, working through the backlog.
 *
 * Replaces a "posts created in the last 24 hours" query that made this
 * effectively a no-op: the real publish cadence is about one post every four
 * days, so most runs found nothing. There are also 120 existing posts that
 * have never been syndicated — at one a day that is months of daily backlinks
 * from content already written, which the 24-hour window could never reach.
 *
 * Selection prefers posts with the most Search Console impressions. A post
 * Google already shows is better content, so its syndicated copy is likelier
 * to earn engagement on the destination platform — and engagement there is
 * what makes the link worth more than a directory listing.
 */
export async function runSyndicate(
  opts: { dryRun?: boolean } = {}
): Promise<SyndicateResult> {
  if (!hasSupabaseConfig) throw new Error("Missing Supabase config");
  const supabase = getSupabase();

  // Any platform not yet 'published' for a post is still outstanding —
  // 'failed' rows are retried, 'skipped' rows retry once credentials exist.
  const { data: doneRows } = await supabase
    .from("blog_syndications")
    .select("blog_slug, platform, status")
    .eq("status", "published")
    .limit(20000);

  const publishedBySlug = new Map<string, Set<string>>();
  for (const row of (doneRows ?? []) as { blog_slug: string; platform: string }[]) {
    const set = publishedBySlug.get(row.blog_slug) ?? new Set<string>();
    set.add(row.platform);
    publishedBySlug.set(row.blog_slug, set);
  }

  const { data: posts } = await supabase
    .from("blogs")
    .select("id, title, slug, content, keywords, created_at")
    .order("created_at", { ascending: false })
    .limit(2000);

  type Post = {
    id: string;
    title: string;
    slug: string;
    content: string | null;
    keywords: string | null;
    created_at: string;
  };
  const all = (posts ?? []) as Post[];

  // A post is outstanding when at least one platform hasn't published it.
  const outstanding = all.filter((p) => {
    if (!p.content?.trim()) return false;
    const done = publishedBySlug.get(p.slug);
    return !done || done.size < PLATFORMS.length;
  });

  if (outstanding.length === 0) {
    return { success: true, skipped: true, reason: "backlog empty — every post is on every platform" };
  }

  // Rank by impressions where we have them; blog_gsc_stats is optional.
  const { data: stats } = await supabase
    .from("blog_gsc_stats")
    .select("slug, impressions")
    .limit(20000);
  const impBySlug = new Map<string, number>();
  for (const s of (stats ?? []) as { slug: string; impressions: number }[]) {
    impBySlug.set(s.slug, s.impressions);
  }

  outstanding.sort((a, b) => {
    const ia = impBySlug.get(a.slug) ?? 0;
    const ib = impBySlug.get(b.slug) ?? 0;
    if (ib !== ia) return ib - ia;
    // No GSC data for either: newest first.
    return b.created_at.localeCompare(a.created_at);
  });

  const post = outstanding[0];
  const alreadyDone = publishedBySlug.get(post.slug) ?? new Set<string>();
  const todo = PLATFORMS.filter((p) => !alreadyDone.has(p.key));

  // Dry run exits here — after the real selection has run, before any network
  // call or row write. Shares the code path with a live run on purpose: a
  // preview that reimplements the query is a preview that drifts.
  if (opts.dryRun) {
    return {
      success: true,
      dryRun: true,
      slug: post.slug,
      title: post.title,
      impressions: impBySlug.get(post.slug) ?? 0,
      wouldPostTo: todo.map((p) => p.label),
      alreadyDone: [...alreadyDone],
      remaining: outstanding.length - 1,
      queuePreview: outstanding.slice(1, 6).map((p) => ({
        slug: p.slug,
        impressions: impBySlug.get(p.slug) ?? 0,
      })),
    };
  }

  const tags = (post.keywords ?? "invoice OCR, data extraction")
    .split(",")
    .map((t: string) => t.trim())
    .filter(Boolean);

  const results = await Promise.all(
    todo.map(async (platform) => {
      const outcome = await platform.post(post.title, post.content!, post.slug, tags);
      const status = outcome.success
        ? "published"
        : outcome.error?.startsWith("Missing")
          ? "skipped"
          : "failed";

      // Upsert on (blog_slug, platform) — this is what makes a double run
      // idempotent instead of a double publish.
      await supabase.from("blog_syndications").upsert(
        {
          blog_slug: post.slug,
          platform: platform.key,
          status,
          external_url: outcome.url ?? null,
          error: outcome.error?.slice(0, 500) ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "blog_slug,platform" }
      );

      return { label: platform.label, status, ...outcome };
    })
  );

  const published = results.filter((r) => r.status === "published").length;
  const impressions = impBySlug.get(post.slug) ?? 0;

  const report = `📢 <b>Content Syndication</b>

📝 <b>${post.title}</b>
📊 ${impressions} GSC impressions${alreadyDone.size > 0 ? ` • ${alreadyDone.size}/${PLATFORMS.length} platform(s) already done` : ""}

${results
  .map((r) => {
    if (r.status === "published") return `✅ <b>${r.label}</b>: <a href="${r.url}">Published</a>`;
    if (r.status === "skipped") return `⏭️ <b>${r.label}</b>: not configured`;
    return `❌ <b>${r.label}</b>: ${r.error?.slice(0, 120)}`;
  })
  .join("\n")}

🔗 ${published} backlink(s) created, canonical → ${SITE_URL}/blog/${post.slug}
📚 Backlog: ${outstanding.length - 1} post(s) still to syndicate
${results.some((r) => r.status === "skipped") ? "\n💡 Add the missing keys to enable: DEVTO_API_KEY, HASHNODE_API_KEY, HASHNODE_PUBLICATION_ID" : ""}`;

  await sendTelegramMessage(report);

  return {
    success: true,
    slug: post.slug,
    published,
    retried: alreadyDone.size,
    remaining: outstanding.length - 1,
  };
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const dryRun = new URL(request.url).searchParams.get("dryRun") === "1";
    return NextResponse.json(await runSyndicate({ dryRun }));
  } catch (err) {
    console.error("[Syndicate Cron] Error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    await sendTelegramMessage(`❌ <b>Syndication Cron Failed</b>\n\nError: ${message}`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
