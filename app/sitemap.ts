import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { SITE_URL } from "@/lib/site";
import { sitemapEntries as loadEntries } from "@/lib/v2/public-data";
import { buildSitemap } from "@/lib/v2/sitemap-build";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection(); // shops come and go, so this is built per request instead of once at deploy time
  const entries = await loadEntries().catch(() => ({ shops: [], products: [] }));
  return buildSitemap(SITE_URL, entries);
}
