// Shops kept out of the public marketplace (directory, product grid, search and sitemap) by exact slug, set in MARKETPLACE_UNLISTED_SLUGS.
// Their own pages, chat and staff sign-in keep working; nothing is deleted or hidden in the database.
export function parseUnlisted(value: string | undefined): string[] {
  const slugs = (value ?? "").split(",").map((s) => s.trim()).filter((s) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(s)); // anything else (a pattern, a typo) is ignored
  return Array.from(new Set(slugs)).slice(0, 100);
}

export const unlistedSlugs = (): string[] => parseUnlisted(process.env.MARKETPLACE_UNLISTED_SLUGS);
export const isUnlisted = (slug: string): boolean => unlistedSlugs().includes(slug);
