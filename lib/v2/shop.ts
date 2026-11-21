import { db } from "@/lib/db";
import type { Faq, Product, ShopData } from "@/lib/shop-data";
import type { WeekHours } from "@/lib/v2/hours";

// Server-only. Builds the same ShopData shape the original app uses, so buildKnowledge() and priceOrder() work per seller unchanged.
const EMPTY_SHIPPING: ShopData["shipping"] = { freeAbove: 0, fee: 0, worldwideDays: "", domesticDays: "", notes: "" };
const EMPTY_POLICIES: ShopData["policies"] = { returns: "", payment: "", customOrders: "", discounts: "", giftWrap: "", care: "" };

export type SellerRow = {
  id: string;
  slug: string;
  shop_name: string;
  owner_name: string;
  country: string;
  tagline: string;
  about: string;
  languages: string[];
  nexconn_user_id: string;
  hours: string;
  response_target_min: number;
  tone: string;
  agent_name: string;
  business_hours: WeekHours | null;
  timezone: string;
  away_message: string;
};

// The assistant's display name: the owner's choice, or "<Shop> Assistant" until they pick one.
export const assistantName = (shopName: string, agentName: string | null | undefined) => (agentName?.trim() ? agentName.trim() : `${shopName} Assistant`);

export async function sellerByNexconnId(nexconnUserId: string): Promise<SellerRow | null> {
  const [row] = await db()`SELECT id, slug, shop_name, owner_name, country, tagline, about, languages, nexconn_user_id, hours, response_target_min, tone, agent_name, business_hours, timezone, away_message
    FROM sellers WHERE nexconn_user_id = ${nexconnUserId}`;
  return (row as SellerRow | undefined) ?? null;
}

export async function sellerBySlug(slug: string): Promise<SellerRow | null> {
  const [row] = await db()`SELECT id, slug, shop_name, owner_name, country, tagline, about, languages, nexconn_user_id, hours, response_target_min, tone, agent_name, business_hours, timezone, away_message
    FROM sellers WHERE slug = ${slug}`;
  return (row as SellerRow | undefined) ?? null;
}

export async function loadShop(sellerId: string): Promise<{ shop: ShopData; extra: string }> {
  const sql = db();
  const [[s], products, faqRows, glossary] = await Promise.all([
    sql`SELECT shop_name, tagline, about, country, hours, shipping, policies FROM sellers WHERE id = ${sellerId}`,
    sql`SELECT id, name, description, price_usd, colors, sizes, stock, active FROM products WHERE seller_id = ${sellerId} AND active ORDER BY created_at`,
    sql`SELECT q, a FROM faqs WHERE seller_id = ${sellerId} ORDER BY created_at`,
    sql`SELECT term, rule, note FROM glossary WHERE seller_id = ${sellerId}`,
  ]);
  const shop: ShopData = {
    name: s.shop_name,
    tagline: [s.tagline, s.about].filter(Boolean).join(" "),
    location: s.country,
    hours: s.hours,
    contact: "",
    products: products.map(
      (p): Product => ({
        id: p.id,
        name: p.name,
        description: p.description,
        price: p.price_usd,
        colors: p.colors,
        sizes: p.sizes,
        inStock: p.stock > 0,
      }),
    ),
    shipping: { ...EMPTY_SHIPPING, ...(s.shipping as object) },
    policies: { ...EMPTY_POLICIES, ...(s.policies as object) },
    faqs: faqRows.map((f): Faq => ({ q: f.q, a: f.a })),
  };
  const keep = glossary.filter((g) => g.rule === "keep").map((g) => g.term);
  // Explicit replacement wording; "consistently" alone let the AI keep the original term.
  const fixed = glossary.filter((g) => g.rule === "fixed" && g.note).map((g) => `"${g.term}" must always be written as "${g.note}"`);
  const extra = [
    keep.length ? `Never translate these terms; write them exactly as given: ${keep.join(", ")}.` : "",
    fixed.length ? `Term replacements, applied in every reply language: ${fixed.join("; ")}. Never use the original term in the reply.` : "",
  ]
    .filter(Boolean)
    .join("\n");
  return { shop, extra };
}
