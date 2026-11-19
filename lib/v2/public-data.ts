import { db } from "@/lib/db";

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
};

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
  const rows = await db()`SELECT s.slug, s.shop_name, s.tagline, s.country, s.languages, s.response_target_min,
      EXISTS (SELECT 1 FROM staff st WHERE st.seller_id = s.id AND st.available
        AND st.last_seen > now() - make_interval(secs => ${ONLINE_WINDOW_SECONDS})) AS team_online,
      (SELECT count(*)::int FROM products p WHERE p.seller_id = s.id AND p.active) AS product_count
    FROM sellers s
    WHERE (${q} = '' OR position(lower(${q}) in lower(s.shop_name || ' ' || s.tagline || ' ' || s.country)) > 0)
      AND (${country} = '' OR lower(s.country) = lower(${country}))
    ORDER BY team_online DESC, s.created_at DESC
    LIMIT 100`;
  return rows.map((r) => ({
    slug: r.slug,
    name: r.shop_name,
    tagline: r.tagline,
    country: r.country,
    languages: r.languages,
    teamOnline: r.team_online,
    productCount: r.product_count,
    responseTargetMin: r.response_target_min,
  }));
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
      s.id AS seller_id, s.slug, s.shop_name, s.country, s.languages, s.hours, s.shipping, s.policies
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
      teamOnline: await isTeamOnline(r.seller_id as string),
      hours: r.hours as string,
      shipping: r.shipping as Record<string, unknown>,
      policies: r.policies as Record<string, unknown>,
    },
  };
}

export async function isTeamOnline(sellerId: string): Promise<boolean> {
  const [row] = await db()`SELECT EXISTS (SELECT 1 FROM staff WHERE seller_id = ${sellerId} AND available
      AND last_seen > now() - make_interval(secs => ${ONLINE_WINDOW_SECONDS})) AS online`;
  return row.online as boolean;
}

export async function sellerDetail(slug: string) {
  const [s] = await db()`SELECT id, slug, shop_name, tagline, about, country, languages, hours, shipping, policies, response_target_min
    FROM sellers WHERE slug = ${slug}`;
  if (!s) return null;
  const [products, faqs, teamOnline] = await Promise.all([
    db()`SELECT id, name, description, category, price_usd, colors, sizes, stock, image_url
      FROM products WHERE seller_id = ${s.id} AND active ORDER BY created_at`,
    db()`SELECT q, a FROM faqs WHERE seller_id = ${s.id} ORDER BY created_at`,
    isTeamOnline(s.id),
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
    },
    products: products.map(mapProduct),
    faqs: faqs.map((f) => ({ q: f.q as string, a: f.a as string })),
  };
}
