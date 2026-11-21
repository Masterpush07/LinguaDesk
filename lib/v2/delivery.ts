// Shared by server and browser: the delivery address a buyer gives when confirming an order, and the shop's payment link.

export type Delivery = {
  fullName: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
};

export const EMPTY_DELIVERY: Delivery = { fullName: "", phone: "", line1: "", line2: "", city: "", region: "", postalCode: "", country: "" };

type Rule = { key: keyof Delivery; label: string; min: number; max: number; pattern?: RegExp; patternMessage?: string };

// Every field is plain text. Control characters are removed and the length is capped, so a stored address cannot carry markup or huge payloads.
const RULES: Rule[] = [
  { key: "fullName", label: "Full name", min: 2, max: 80 },
  { key: "phone", label: "Phone number", min: 6, max: 20, pattern: /^[0-9+()\-\s]+$/, patternMessage: "Phone number can only contain digits, spaces, + ( ) and -." },
  { key: "line1", label: "Address", min: 3, max: 120 },
  { key: "line2", label: "Apartment, floor or landmark", min: 0, max: 120 },
  { key: "city", label: "City", min: 2, max: 60 },
  { key: "region", label: "State or region", min: 0, max: 60 },
  { key: "postalCode", label: "Postal code", min: 2, max: 12, pattern: /^[A-Za-z0-9][A-Za-z0-9\s-]*$/, patternMessage: "Postal code can only contain letters, digits, spaces and -." },
  { key: "country", label: "Country", min: 2, max: 60 },
];

const clean = (v: unknown) => (typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim() : "");

export type DeliveryResult = { ok: true; delivery: Delivery } | { ok: false; error: string; field?: keyof Delivery };

export function validateDelivery(input: unknown): DeliveryResult {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { ok: false, error: "Add your delivery address to confirm the order." };
  const raw = input as Record<string, unknown>;
  const delivery = { ...EMPTY_DELIVERY };
  for (const r of RULES) {
    const value = clean(raw[r.key]);
    if (value.length < r.min) return { ok: false, field: r.key, error: r.min <= 1 ? `${r.label} is required.` : `${r.label} must be at least ${r.min} characters.` };
    if (value.length > r.max) return { ok: false, field: r.key, error: `${r.label} must be at most ${r.max} characters.` };
    if (value && r.pattern && !r.pattern.test(value)) return { ok: false, field: r.key, error: r.patternMessage ?? `${r.label} is not valid.` };
    delivery[r.key] = value;
  }
  return { ok: true, delivery };
}

// Reads a stored address back into a safe shape; anything missing becomes an empty string.
export function readDelivery(value: unknown): Delivery | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const delivery = { ...EMPTY_DELIVERY };
  for (const r of RULES) delivery[r.key] = clean(raw[r.key]).slice(0, r.max);
  return delivery.line1 ? delivery : null;
}

export function formatDelivery(d: Delivery): string {
  return [d.fullName, d.line1, d.line2, [d.city, d.region, d.postalCode].filter(Boolean).join(", "), d.country, d.phone && `Phone: ${d.phone}`].filter(Boolean).join("\n");
}

export const PAYMENT_LINK_MAX = 300;
export const PAYMENT_NOTE_MAX = 300;

// The shop's own payment page (for example a PayPal.me, Razorpay or Stripe payment link). Only https, no embedded passwords.
export function validatePaymentLink(input: unknown): { ok: true; link: string } | { ok: false; error: string } {
  const value = typeof input === "string" ? input.trim() : "";
  if (!value) return { ok: true, link: "" };
  if (value.length > PAYMENT_LINK_MAX) return { ok: false, error: `The payment link must be at most ${PAYMENT_LINK_MAX} characters.` };
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { ok: false, error: "The payment link must be a full web address such as https://paypal.me/yourshop." };
  }
  if (url.protocol !== "https:") return { ok: false, error: "The payment link must start with https://." };
  if (url.username || url.password) return { ok: false, error: "The payment link cannot contain a username or password." };
  if (!url.hostname.includes(".")) return { ok: false, error: "The payment link must be a full web address such as https://paypal.me/yourshop." };
  return { ok: true, link: url.toString() };
}
