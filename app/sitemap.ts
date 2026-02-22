import type { MetadataRoute } from "next";
import { getSupabase, hasSupabaseConfig } from "@/lib/supabase";

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.invoicetodata.com";

const staticRoutes: MetadataRoute.Sitemap = [
  { url: baseUrl, lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
  { url: `${baseUrl}/tools`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.9 },
  { url: `${baseUrl}/blog`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.9 },
  { url: `${baseUrl}/tools/pdf-to-excel`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.8 },
  { url: `${baseUrl}/tools/pdf-to-gsheet`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
];

type BlogRow = { slug: string; updated_at: string | null; created_at?: string };

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let blogEntries: MetadataRoute.Sitemap = [];

  if (hasSupabaseConfig) {
    try {
      const supabase = getSupabase();
      const { data } = await supabase
        .from("blogs")
        .select("slug, updated_at, created_at")
        .order("updated_at", { ascending: false });

      if (data && Array.isArray(data)) {
        blogEntries = (data as BlogRow[]).map((post) => ({
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
    } catch {
      // ignore fetch errors; return static routes only
    }
  }

  return [...staticRoutes, ...blogEntries];
}
