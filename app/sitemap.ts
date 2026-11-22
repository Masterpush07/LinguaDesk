import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { SITE_URL } from "@/lib/site";
import { sitemapEntries as loadEntries } from "@/lib/v2/public-data";

const PAGES = ["", "/marketplace", "/sell", "/pricing", "/demo", "/privacy"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection(); // shops come and go, so this is built per request instead of once at deploy time
  const { shops, products } = await loadEntries().catch(() => ({ shops: [], products: [] }));
  return [
    ...PAGES.map((path) => ({ url: `${SITE_URL}${path}`, changeFrequency: "weekly" as const, priority: path === "" ? 1 : 0.7 })),
    ...shops.map((s) => ({ url: `${SITE_URL}/s/${encodeURIComponent(s.slug)}`, lastModified: s.at, changeFrequency: "daily" as const, priority: 0.8 })),
    ...products.map((p) => ({ url: `${SITE_URL}/s/${encodeURIComponent(p.slug)}/p/${encodeURIComponent(p.id)}`, lastModified: p.at, changeFrequency: "weekly" as const, priority: 0.6 })),
  ];
}
