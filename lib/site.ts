// The public address of the site, used for share previews, robots.txt and the sitemap.
// Vercel provides the production domain; the fallback keeps local development on localhost.
export const SITE_URL = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : process.env.NODE_ENV === "production"
    ? "https://lingua-desk-one.vercel.app"
    : "http://localhost:3000";

// Cuts text for a meta description (search results and chat apps show about 160 characters).
export function clip(text: string, max = 160): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).trimEnd()}…`;
}
