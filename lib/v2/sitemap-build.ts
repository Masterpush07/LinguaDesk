import type { MetadataRoute } from "next";
import { productPath, storefrontPath } from "@/lib/v2/seller-paths";

type Entries = { shops: { slug: string; at: Date }[]; products: { id: string; slug: string; at: Date }[] };

const PAGES = ["", "/marketplace", "/sell", "/pricing", "/demo", "/privacy"];

// The sitemap lists exactly what the database holds, under the slug it holds: nothing is added, hidden or rewritten here.
export function buildSitemap(siteUrl: string, { shops, products }: Entries): MetadataRoute.Sitemap {
  return [
    ...PAGES.map((path) => ({ url: `${siteUrl}${path}`, changeFrequency: "weekly" as const, priority: path === "" ? 1 : 0.7 })),
    ...shops.map((s) => ({ url: `${siteUrl}${storefrontPath(s.slug)}`, lastModified: s.at, changeFrequency: "daily" as const, priority: 0.8 })),
    ...products.map((p) => ({ url: `${siteUrl}${productPath(p.slug, p.id)}`, lastModified: p.at, changeFrequency: "weekly" as const, priority: 0.6 })),
  ];
}
