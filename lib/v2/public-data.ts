import { db } from "@/lib/db";
import { iso } from "@/lib/v2/seller-api";
import { isOpenNow, type WeekHours } from "@/lib/v2/hours";

// Server-only. Shapes returned by the public (no sign-in) marketplace API. Nothing here exposes staff, passcodes or chat identities.
const ONLINE_WINDOW_SECONDS = 90;

export type PublicSellerSummary = {
  slug: string;
  name: string;
  tagline: string;
  country: string;
  languages: string[];
  teamOnline: boolean;
  productCount: number;
  responseTargetMin: number;
  rating: number | null;
  reviewCount: number;
};

export type PublicReview = { rating: number; body: string; createdAt: string };

export type PublicProduct = {
  id: string;
  name: string;
  description: string;
  category: string;
  priceUsd: number;
  colors: string[];
  sizes: string[];
  stock: number;
  imageUrl: string | null;
};

type Row = Record<string, unknown>;

export const cleanParam = (value: string | null, max = 80) => (value ?? "").trim().slice(0, max);

export function mapProduct(r: Row): PublicProduct {
  return {
    id: r.id as string,
    name: r.name as string,
    description: r.description as string,
    category: r.category as string,
    priceUsd: Number(r.price_usd),
    colors: r.colors as string[],
    sizes: r.sizes as string[],
    stock: Number(r.stock),
    imageUrl: (r.image_url as string | null) ?? null,
  };
}

export async function listSellers(q: string, country: string): Promise<PublicSellerSummary[]> {
  // position() instead of LIKE so the visitor's text is never read as a wildcard pattern.
  const rows = await db()`SELECT s.slug, s.shop_name, s.tagline, s.country, s.languages, s.response_target_min, s.business_hours, s.timezone,
      EXISTS (SELECT 1 FROM staff st WHERE st.seller_id = s.id AND st.available
        AND st.last_seen > now() - make_interval(secs => ${ONLINE_WINDOW_SECONDS})) AS team_online,
      (SELECT count(*)::int FROM products p WHERE p.seller_id = s.id AND p.active) AS product_count,
      (SELECT round(avg(rv.rating)::numeric, 1)::float8 FROM reviews rv WHERE rv.seller_id = s.id) AS rating,
      (SELECT count(*)::int FROM reviews rv WHERE rv.seller_id = s.id) AS review_count
    FROM sellers s
    WHERE (${q} = '' OR position(lower(${q}) in lower(s.shop_name || ' ' || s.tagline || ' ' || s.country)) > 0)
      AND (${country} = '' OR lower(s.country) = lower(${country}))
    ORDER BY team_online DESC, s.created_at DESC
    LIMIT 100`;
  const sellers = rows.map((r) => ({
    slug: r.slug,
    name: r.shop_name,
    tagline: r.tagline,
    country: r.country,
    languages: r.languages,
    teamOnline: r.team_online && isOpenNow(r.business_hours as WeekHours, r.timezone as string, new Date()),
    productCount: r.product_count,
    responseTargetMin: r.response_target_min,
    rating: r.review_count === 0 ? null : (r.rating as number),
    reviewCount: r.review_count,
  }));
  // The SQL order ignores business hours, so shops that are open now are moved up (the sort is stable).
  return sellers.sort((a, b) => Number(b.teamOnline) - Number(a.teamOnline));
}

export async function listProducts(q: string, category: string, country: string) {
  const rows = await db()`SELECT p.id, p.name, p.description, p.category, p.price_usd, p.colors, p.sizes, p.stock, p.image_url,
      s.slug AS seller_slug, s.shop_name AS seller_name, s.country AS seller_country
    FROM products p JOIN sellers s ON s.id = p.seller_id
    WHERE p.active
      AND (${q} = '' OR position(lower(${q}) in lower(p.name || ' ' || p.description || ' ' || p.category || ' ' || s.shop_name)) > 0)
      AND (${category} = '' OR lower(p.category) = lower(${category}))
      AND (${country} = '' OR lower(s.country) = lower(${country}))
    ORDER BY p.created_at DESC
    LIMIT 60`;
  return rows.map((r) => ({
    ...mapProduct(r),
    seller: { slug: r.seller_slug as string, name: r.seller_name as string, country: r.seller_country as string },
  }));
}

export async function productDetail(id: string) {
  const [r] = await db()`SELECT p.id, p.name, p.description, p.category, p.price_usd, p.colors, p.sizes, p.stock, p.image_url,
      s.id AS seller_id, s.slug, s.shop_name, s.country, s.languages, s.hours, s.shipping, s.policies, s.business_hours, s.timezone
    FROM products p JOIN sellers s ON s.id = p.seller_id
    WHERE p.id = ${id} AND p.active`;
  if (!r) return null;
  return {
    ...mapProduct(r),
    seller: {
      slug: r.slug as string,
      name: r.shop_name as string,
      country: r.country as string,
      languages: r.languages as string[],
      teamOnline: await isTeamOnline(r.seller_id as string, r.business_hours as WeekHours, r.timezone as string),
      hours: r.hours as string,
      shipping: r.shipping as Record<string, unknown>,
      policies: r.policies as Record<string, unknown>,
    },
  };
}

// Online means a staff member is available and recently seen, and the shop is inside its business hours.
export async function isTeamOnline(sellerId: string, businessHours: WeekHours, timeZone: string): Promise<boolean> {
  if (!isOpenNow(businessHours, timeZone, new Date())) return false;
  const [row] = await db()`SELECT EXISTS (SELECT 1 FROM staff WHERE seller_id = ${sellerId} AND available
      AND last_seen > now() - make_interval(secs => ${ONLINE_WINDOW_SECONDS})) AS online`;
  return row.online as boolean;
}

export async function sellerDetail(slug: string) {
  const [s] = await db()`SELECT id, slug, shop_name, tagline, about, country, languages, hours, shipping, policies, response_target_min, business_hours, timezone
    FROM sellers WHERE slug = ${slug}`;
  if (!s) return null;
  const [products, faqs, teamOnline, [stats], reviews] = await Promise.all([
    db()`SELECT id, name, description, category, price_usd, colors, sizes, stock, image_url
      FROM products WHERE seller_id = ${s.id} AND active ORDER BY created_at`,
    db()`SELECT q, a FROM faqs WHERE seller_id = ${s.id} ORDER BY created_at`,
    isTeamOnline(s.id, s.business_hours as WeekHours, s.timezone as string),
    db()`SELECT round(avg(rating)::numeric, 1)::float8 AS rating, count(*)::int AS review_count FROM reviews WHERE seller_id = ${s.id}`,
    db()`SELECT rating, body, created_at FROM reviews WHERE seller_id = ${s.id} ORDER BY created_at DESC LIMIT 5`,
  ]);
  return {
    seller: {
      slug: s.slug as string,
      name: s.shop_name as string,
      tagline: s.tagline as string,
      about: s.about as string,
      country: s.country as string,
      languages: s.languages as string[],
      hours: s.hours as string,
      shipping: s.shipping as Record<string, unknown>,
      policies: s.policies as Record<string, unknown>,
      teamOnline,
      responseTargetMin: s.response_target_min as number,
      rating: stats.review_count === 0 ? null : (stats.rating as number),
      reviewCount: stats.review_count as number,
    },
    reviews: reviews.map((r): PublicReview => ({ rating: r.rating as number, body: r.body as string, createdAt: iso(r.created_at) ?? "" })),
    products: products.map(mapProduct),
    faqs: faqs.map((f) => ({ q: f.q as string, a: f.a as string })),
  };
}

// One-row lookups for page titles and share previews, so rendering metadata stays cheap.
export async function shopMeta(slug: string) {
  const [r] = await db()`SELECT s.shop_name, s.tagline, s.about, s.country,
      (SELECT p.image_url FROM products p WHERE p.seller_id = s.id AND p.active AND p.image_url IS NOT NULL ORDER BY p.created_at LIMIT 1) AS image_url
    FROM sellers s WHERE s.slug = ${slug}`;
  if (!r) return null;
  return { name: r.shop_name as string, text: ((r.tagline as string) || (r.about as string) || "").trim(), country: r.country as string, imageUrl: (r.image_url as string | null) ?? null };
}

export async function productMeta(sellerSlug: string, id: string) {
  const [r] = await db()`SELECT p.name, p.description, p.price_usd, p.image_url, s.shop_name
    FROM products p JOIN sellers s ON s.id = p.seller_id
    WHERE p.id = ${id} AND p.active AND s.slug = ${sellerSlug}`;
  if (!r) return null;
  return { name: r.name as string, description: r.description as string, priceUsd: Number(r.price_usd), imageUrl: (r.image_url as string | null) ?? null, shopName: r.shop_name as string };
}

// Every public page a search engine may list: shops and their active products.
export async function sitemapEntries() {
  const sql = db();
  const [shops, products] = await Promise.all([
    sql`SELECT slug, created_at FROM sellers ORDER BY created_at DESC LIMIT 1000`,
    sql`SELECT p.id, p.updated_at, s.slug FROM products p JOIN sellers s ON s.id = p.seller_id WHERE p.active ORDER BY p.updated_at DESC LIMIT 5000`,
  ]);
  return {
    shops: shops.map((r) => ({ slug: r.slug as string, at: new Date(r.created_at as string) })),
    products: products.map((r) => ({ id: r.id as string, slug: r.slug as string, at: new Date(r.updated_at as string) })),
  };
}
