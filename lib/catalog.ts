// Shared by server and browser: the single function that prices an order, and the order card format.
// Products and shipping rules come from the shop's own settings (lib/shop-data.ts), never from the AI.
import type { ShopOrderInfo } from "@/lib/shop-data";

const MAX_LINES = 8;
const MAX_QTY = 20;

export type OrderLine = { id: string; qty: number };
export type PricedLine = { id: string; name: string; qty: number; unit: number; amount: number };
export type Priced = { lines: PricedLine[]; subtotal: number; shipping: number; total: number };

// Totals are always computed here in code, never by the AI. Returns null for anything invalid or out of stock.
export function priceOrder(input: unknown, shop: ShopOrderInfo): Priced | null {
  if (!Array.isArray(input) || input.length === 0 || input.length > MAX_LINES) return null;
  const qtyById = new Map<string, number>();
  for (const line of input as OrderLine[]) {
    if (!line || typeof line.id !== "string" || !Number.isInteger(line.qty) || line.qty < 1) return null;
    qtyById.set(line.id, (qtyById.get(line.id) ?? 0) + line.qty);
  }
  const lines: PricedLine[] = [];
  for (const [id, qty] of qtyById) {
    const product = shop.products.find((p) => p.id === id);
    if (!product || !product.inStock || qty > MAX_QTY) return null;
    lines.push({ id, name: product.name, qty, unit: product.price, amount: product.price * qty });
  }
  const subtotal = lines.reduce((sum, l) => sum + l.amount, 0);
  const { freeAbove, fee } = shop.shipping;
  const shipping = freeAbove > 0 && subtotal > freeAbove ? 0 : fee;
  return { lines, subtotal, shipping, total: subtotal + shipping };
}

export const LABEL_KEYS = ["title", "subtotal", "shipping", "total", "free", "confirm", "confirmed"] as const;
export type LabelKey = (typeof LABEL_KEYS)[number];
export type OrderLabels = Record<LabelKey, string>;

export const ENGLISH_LABELS: OrderLabels = {
  title: "Your order",
  subtotal: "Subtotal",
  shipping: "Shipping",
  total: "Total",
  free: "Free",
  confirm: "Confirm order",
  confirmed: "Order confirmed. Thank you!",
};

// The order card travels in the message metadata; labels and product names are in the customer's language, numbers are not.
export type OrderCard = {
  id: string;
  lines: { name: string; qty: number; unit: number; amount: number }[];
  subtotal: number;
  shipping: number;
  total: number;
  labels: OrderLabels;
};

// Plain-text version of a card: shown by clients that cannot draw the card, and kept in the chat history.
export function orderSummary(card: OrderCard): string {
  const items = card.lines.map((l) => `${l.qty} x ${l.name} ($${l.amount})`).join(", ");
  const shipping = card.shipping === 0 ? card.labels.free : `$${card.shipping}`;
  return `${card.labels.title}: ${items}. ${card.labels.shipping}: ${shipping}. ${card.labels.total}: $${card.total}`;
}

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

// Metadata arrives as a string from the network, so check its shape before drawing it.
export function parseOrderCard(raw: string | undefined): OrderCard | null {
  if (!raw) return null;
  try {
    const c = JSON.parse(raw) as OrderCard;
    const ok =
      typeof c.id === "string" &&
      Array.isArray(c.lines) &&
      c.lines.every((l) => typeof l.name === "string" && isNum(l.qty) && isNum(l.unit) && isNum(l.amount)) &&
      isNum(c.subtotal) &&
      isNum(c.shipping) &&
      isNum(c.total) &&
      !!c.labels &&
      LABEL_KEYS.every((k) => typeof c.labels[k] === "string");
    return ok ? c : null;
  } catch {
    return null;
  }
}
