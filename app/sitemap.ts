import type { MetadataRoute } from "next";
import { getSupabase, hasSupabaseConfig } from "@/lib/supabase";
import { getAllBankSlugs } from "@/lib/bankEntities";

/**
 * Cached for an hour. Was `force-dynamic` with `revalidate = 0`, which meant
 * two Supabase queries on every crawler fetch of a document that changes a few
 * times a day.
 */
export const revalidate = 3600;

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.invoicetodata.com";

/**
 * Real dates, maintained by hand.
 *
 * Every entry here used to be `new Date()` — the moment the sitemap was
 * generated, not the moment the page changed. Fetch the sitemap twice a minute
 * apart and every lastmod moved, which is precisely the pattern Google
 * describes as an inaccurate lastmod, and its documented response is to stop
 * trusting the field for the whole site.
 *
 * That mattered more than it looks. When Google retired the sitemap ping
 * endpoint in 2023 it named lastmod as the replacement signal for "recrawl
 * this" — so a sitemap that cries wolf on every URL disables the one
 * recrawl-scheduling lever left, at exactly the moment it is needed: a
 * canonical change that is invisible until the page is fetched again.
 *
 * Update the date when the page's content or metadata actually changes. A
 * stale-but-honest date costs nothing; a fresh-but-false one costs the
 * credibility of every other date in the file.
 */
const STATIC_PAGES: { path: string; lastModified: string; priority: number; changeFrequency: "daily" | "weekly" | "monthly" }[] = [
  // 2026-09-12: self-referencing canonical added (was inheriting the homepage's).
  // 2026-09-13: paid size cap 25MB -> 23MB in the dropzone copy.
  { path: "/tools/pdf-to-excel", lastModified: "2026-09-13", priority: 1.0, changeFrequency: "weekly" },
  { path: "/tools/bank-statement-to-excel", lastModified: "2026-09-13", priority: 1.0, changeFrequency: "weekly" },
  { path: "/tools/pdf-to-gsheet", lastModified: "2026-09-12", priority: 0.8, changeFrequency: "monthly" },
  // 2026-09-06: industry grid rebuilt, duplicate and dead links removed.
  // Missing from this file until 2026-09-13 despite carrying the largest
  // impression pool on the site — nothing was telling Google it existed
  // beyond the links pointing at it.
  { path: "/tools", lastModified: "2026-09-12", priority: 0.9, changeFrequency: "weekly" },
  { path: "/blog", lastModified: "2026-09-12", priority: 0.9, changeFrequency: "daily" },
  { path: "/pricing", lastModified: "2026-09-12", priority: 0.9, changeFrequency: "monthly" },
  { path: "/how-it-works", lastModified: "2026-08-22", priority: 0.7, changeFrequency: "monthly" },
  { path: "/business", lastModified: "2026-08-22", priority: 0.7, changeFrequency: "monthly" },
  { path: "", lastModified: "2026-09-13", priority: 1.0, changeFrequency: "weekly" },
];

/**
 * When the bank pages last changed in substance. They are rendered from
 * lib/bankEntities.ts and app/tools/bank/[bank]/page.tsx, so they all move
 * together and one date is the honest answer for the set.
 */
const BANK_PAGES_LAST_MODIFIED = "2026-09-13"; // password unlock added to the embedded tool

const staticRoutes: MetadataRoute.Sitemap = STATIC_PAGES.map((p) => ({
  url: `${baseUrl}${p.path}`,
  lastModified: new Date(p.lastModified),
  changeFrequency: p.changeFrequency,
  priority: p.priority,
}));

// Layer 4 — Programmatic SEO bank pages, generated from `lib/bankEntities.ts`.
// Each entry produces a /tools/bank/{slug} long-tail landing page targeting
// "convert {bank} statement to excel" search queries.
const bankRoutes: MetadataRoute.Sitemap = getAllBankSlugs().map((slug) => ({
  url: `${baseUrl}/tools/bank/${slug}`,
  lastModified: new Date(BANK_PAGES_LAST_MODIFIED),
  changeFrequency: "monthly" as const,
  priority: 0.8,
}));

type BlogRow = { slug: string; updated_at: string | null; created_at?: string };
type LandingPageRow = { slug: string; created_at: string | null };

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let blogEntries: MetadataRoute.Sitemap = [];
  let toolEntries: MetadataRoute.Sitemap = [];

  if (hasSupabaseConfig) {
    try {
      const supabase = getSupabase();
      const [blogsRes, landingRes] = await Promise.all([
        supabase
          .from("blogs")
          .select("slug, updated_at, created_at")
          .order("updated_at", { ascending: false })
          .limit(10000),
        supabase.from("landing_pages").select("slug, created_at").limit(10000),
      ]);

      if (blogsRes.data && Array.isArray(blogsRes.data)) {
        blogEntries = (blogsRes.data as BlogRow[]).map((post) => ({
          url: `${baseUrl}/blog/${post.slug}`,
          lastModified: post.updated_at
            ? new Date(post.updated_at)
            : post.created_at
              ? new Date(post.created_at)
              : new Date(BANK_PAGES_LAST_MODIFIED),
          changeFrequency: "weekly" as const,
          priority: 0.7,
        }));
      }

      if (landingRes.data && Array.isArray(landingRes.data)) {
        const pages = (landingRes.data as LandingPageRow[]).filter((r) => r.slug?.trim());
        // landing_pages has no updated_at, so created_at is the most accurate
        // date available. Honest and stable, which is the point — these pages
        // are generated once and rarely touched after.
        toolEntries = pages.map((page) => ({
          url: `${baseUrl}/tools/${page.slug}`,
          lastModified: page.created_at ? new Date(page.created_at) : new Date("2026-08-22"),
          changeFrequency: "monthly" as const,
          priority: 0.7,
        }));
      }
    } catch {
      // ignore fetch errors; return static routes only
    }
  }

  return [...staticRoutes, ...bankRoutes, ...toolEntries, ...blogEntries];
}
