// Shared by server and browser: the shape of the shop's knowledge, how it is validated, and how it becomes AI context.
// This is the single source of truth for products, prices, shipping and policies: the AI, the order builder and the
// customer's "About this shop" panel all read from it, and the owner edits it on the Shop settings page.

export type Product = {
  id: string;
  name: string;
  description: string;
  price: number; // whole US dollars
  colors: string[];
  sizes: string[];
  inStock: boolean;
};
export type Faq = { q: string; a: string };
export type ShopData = {
  name: string;
  tagline: string;
  location: string;
  hours: string;
  contact: string;
  products: Product[];
  shipping: {
    freeAbove: number;
    fee: number;
    worldwideDays: string;
    domesticDays: string;
    notes: string;
  };
  policies: {
    returns: string;
    payment: string;
    customOrders: string;
    discounts: string;
    giftWrap: string;
    care: string;
  };
  faqs: Faq[];
};
export type ShopOrderInfo = Pick<ShopData, "products" | "shipping">;

export const POLICY_FIELDS = [
  ["returns", "Returns and refunds"],
  ["payment", "Payment"],
  ["customOrders", "Custom orders"],
  ["discounts", "Discounts and bargaining"],
  ["giftWrap", "Gift wrapping"],
  ["care", "Care instructions"],
] as const;

// Keeps every AI request small, which matters on free tiers with per-minute token limits.
export const MAX_KNOWLEDGE_CHARS = 9000;

// The text block the AI is allowed to answer from. Anything not written here is treated as unknown.
export function buildKnowledge(shop: ShopData): string {
  const lines: string[] = [`Shop: ${shop.name}. ${shop.tagline}`.trim()];
  if (shop.location) lines.push(`Location: ${shop.location}.`);
  if (shop.hours) lines.push(`Human support hours: ${shop.hours}.`);
  if (shop.contact) lines.push(shop.contact);

  lines.push("", "Products (prices in US dollars):");
  for (const p of shop.products) {
    const parts = [`- ${p.name}: $${p.price}.`];
    if (p.description) parts.push(p.description);
    if (p.colors.length) parts.push(`Colours: ${p.colors.join(", ")}.`);
    if (p.sizes.length) parts.push(`Sizes: ${p.sizes.join(", ")}.`);
    parts.push(p.inStock ? "In stock." : "Currently out of stock.");
    lines.push(parts.join(" "));
  }

  const s = shop.shipping;
  const cost =
    s.fee === 0
      ? "Shipping is free on all orders."
      : s.freeAbove > 0
        ? `Shipping is free for orders above $${s.freeAbove}, otherwise $${s.fee}.`
        : `Shipping costs $${s.fee} per order.`;
  const days = [
    s.worldwideDays && `Delivery takes ${s.worldwideDays} worldwide`,
    s.domesticDays && `${s.domesticDays} inside the shop's home country`,
  ]
    .filter(Boolean)
    .join(" and ");
  lines.push(
    "",
    `Shipping: ${[cost, days && `${days}.`, s.notes].filter(Boolean).join(" ")}`,
  );

  for (const [key, label] of POLICY_FIELDS) {
    if (shop.policies[key]) lines.push(`${label}: ${shop.policies[key]}`);
  }
  if (shop.faqs.length) {
    lines.push("", "Frequently asked questions:");
    for (const f of shop.faqs) lines.push(`Q: ${f.q} A: ${f.a}`);
  }
  return lines.join("\n");
}

const slugify = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "item";

export type ValidationResult =
  | { ok: true; shop: ShopData }
  | { ok: false; errors: string[] };

// Never trusts the input: every field is checked, trimmed and size-limited before it is stored or sent to an AI.
export function validateShop(input: unknown): ValidationResult {
  const errors: string[] = [];
  const o = (input && typeof input === "object" ? input : {}) as Record<
    string,
    unknown
  >;
  const obj = (v: unknown) =>
    v && typeof v === "object" ? (v as Record<string, unknown>) : {};

  const text = (
    v: unknown,
    label: string,
    max: number,
    required = false,
  ): string => {
    const s = typeof v === "string" ? v.trim() : "";
    if (required && !s) errors.push(`${label} is required.`);
    if (s.length > max) {
      errors.push(`${label} must be at most ${max} characters.`);
      return s.slice(0, max);
    }
    return s;
  };
  const whole = (
    v: unknown,
    label: string,
    min: number,
    max: number,
  ): number => {
    const n = typeof v === "number" ? v : Number(v);
    if (!Number.isInteger(n) || n < min || n > max) {
      errors.push(`${label} must be a whole number from ${min} to ${max}.`);
      return min;
    }
    return n;
  };
  const words = (
    v: unknown,
    label: string,
    maxItems: number,
    maxLen: number,
  ): string[] => {
    const items = (Array.isArray(v) ? v : [])
      .map((x) => (typeof x === "string" ? x.trim() : ""))
      .filter(Boolean);
    if (items.length > maxItems || items.some((x) => x.length > maxLen)) {
      errors.push(
        `${label}: at most ${maxItems} items of ${maxLen} characters each.`,
      );
    }
    return items.slice(0, maxItems).map((x) => x.slice(0, maxLen));
  };

  const rawProducts = Array.isArray(o.products) ? o.products : [];
  if (rawProducts.length < 1 || rawProducts.length > 12)
    errors.push("Add between 1 and 12 products.");
  const usedIds = new Set<string>();
  const products: Product[] = rawProducts.slice(0, 12).map((raw, i) => {
    const p = obj(raw);
    const label = `Product ${i + 1}`;
    const name = text(p.name, `${label} name`, 60, true);
    let id =
      typeof p.id === "string" && /^[a-z0-9-]{1,40}$/.test(p.id)
        ? p.id
        : slugify(name);
    for (let n = 2; usedIds.has(id); n++)
      id = `${slugify(name).slice(0, 36)}-${n}`;
    usedIds.add(id);
    return {
      id,
      name,
      description: text(p.description, `${label} description`, 300),
      price: whole(p.price, `${label} price`, 1, 10000),
      colors: words(p.colors, `${label} colours`, 8, 30),
      sizes: words(p.sizes, `${label} sizes`, 8, 40),
      inStock: p.inStock !== false,
    };
  });

  const s = obj(o.shipping);
  const pol = obj(o.policies);
  const rawFaqs = Array.isArray(o.faqs) ? o.faqs : [];
  if (rawFaqs.length > 15) errors.push("Add at most 15 FAQs.");
  const faqs: Faq[] = [];
  rawFaqs.slice(0, 15).forEach((raw, i) => {
    const f = obj(raw);
    const q = text(f.q, `FAQ ${i + 1} question`, 200);
    const a = text(f.a, `FAQ ${i + 1} answer`, 500);
    if (q && a) faqs.push({ q, a });
    else if (q || a)
      errors.push(`FAQ ${i + 1} needs both a question and an answer.`);
  });

  const shop: ShopData = {
    name: text(o.name, "Shop name", 60, true),
    tagline: text(o.tagline, "Description", 200),
    location: text(o.location, "Location", 100),
    hours: text(o.hours, "Support hours", 120),
    contact: text(o.contact, "Contact note", 200),
    products,
    shipping: {
      freeAbove: whole(s.freeAbove, "Free shipping threshold", 0, 100000),
      fee: whole(s.fee, "Shipping fee", 0, 1000),
      worldwideDays: text(s.worldwideDays, "Worldwide delivery time", 60),
      domesticDays: text(s.domesticDays, "Home-country delivery time", 60),
      notes: text(s.notes, "Shipping notes", 400),
    },
    policies: {
      returns: text(pol.returns, "Returns policy", 500),
      payment: text(pol.payment, "Payment info", 500),
      customOrders: text(pol.customOrders, "Custom orders policy", 500),
      discounts: text(pol.discounts, "Discounts policy", 500),
      giftWrap: text(pol.giftWrap, "Gift wrapping policy", 500),
      care: text(pol.care, "Care instructions", 500),
    },
    faqs,
  };
  if (
    errors.length === 0 &&
    buildKnowledge(shop).length > MAX_KNOWLEDGE_CHARS
  ) {
    errors.push(
      `The shop info is too long (over ${MAX_KNOWLEDGE_CHARS} characters). Shorten some descriptions or FAQs.`,
    );
  }
  return errors.length > 0 ? { ok: false, errors } : { ok: true, shop };
}
