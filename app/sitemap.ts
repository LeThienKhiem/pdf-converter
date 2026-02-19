import { MetadataRoute } from "next";

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.invoicetodata.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = [
    { path: "", priority: 1, changeFrequency: "weekly" as const },
    { path: "tools/pdf-to-excel", priority: 0.9, changeFrequency: "weekly" as const },
    { path: "tools/pdf-to-gsheet", priority: 0.8, changeFrequency: "monthly" as const },
    { path: "blogs", priority: 0.7, changeFrequency: "weekly" as const },
  ];

  return routes.map(({ path, priority, changeFrequency }) => ({
    url: path ? `${baseUrl}/${path}` : baseUrl,
    lastModified: new Date(),
    changeFrequency,
    priority,
  }));
}
