import type { MetadataRoute } from "next";
import { getSupabase, hasSupabaseConfig } from "@/lib/supabase";
import { getAllBankSlugs } from "@/lib/bankEntities";

export const revalidate = 0;
export const dynamic = "force-dynamic";

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.invoicetodata.com";

const staticRoutes: MetadataRoute.Sitemap = [
  { url: `${baseUrl}/tools/pdf-to-excel`, lastModified: new Date(), changeFrequency: "weekly", priority: 1.0 },
  { url: `${baseUrl}/tools/pdf-to-gsheet`, lastModified: new Date(), changeFrequency: "weekly", priority: 1.0 },
  { url: `${baseUrl}/tools/bank-statement-to-excel`, lastModified: new Date(), changeFrequency: "weekly", priority: 1.0 },
  { url: `${baseUrl}/blog`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.9 },
  { url: baseUrl, lastModified: new Date(), changeFrequency: "weekly", priority: 1.0 },
];

// Layer 4 — Programmatic SEO bank pages, generated from `lib/bankEntities.ts`.
// Each entry produces a /tools/bank/{slug} long-tail landing page targeting
// "convert {bank} statement to excel" search queries.
const bankRoutes: MetadataRoute.Sitemap = getAllBankSlugs().map((slug) => ({
  url: `${baseUrl}/tools/bank/${slug}`,
  lastModified: new Date(),
  changeFrequency: "monthly" as const,
  priority: 0.8,
}));

type BlogRow = { slug: string; updated_at: string | null; created_at?: string };
type LandingPageRow = { slug: string };

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
        supabase.from("landing_pages").select("slug").limit(10000),
      ]);

      if (blogsRes.data && Array.isArray(blogsRes.data)) {
        blogEntries = (blogsRes.data as BlogRow[]).map((post) => ({
          url: `${baseUrl}/blog/${post.slug}`,
          lastModified: post.updated_at
            ? new Date(post.updated_at)
            : post.created_at
              ? new Date(post.created_at)
              : new Date(),
          changeFrequency: "weekly" as const,
          priority: 0.7,
        }));
      }

      if (landingRes.data && Array.isArray(landingRes.data)) {
        const pages = (landingRes.data as LandingPageRow[]).filter((r) => r.slug?.trim());
        toolEntries = pages.map((page) => ({
          url: `${baseUrl}/tools/${page.slug}`,
          lastModified: new Date(),
          changeFrequency: "weekly" as const,
          priority: 0.9,
        }));
      }
    } catch {
      // ignore fetch errors; return static routes only
    }
  }

  return [...staticRoutes, ...bankRoutes, ...toolEntries, ...blogEntries];
}
