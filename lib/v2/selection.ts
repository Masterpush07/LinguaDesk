import type { BuyerSelection } from "@/lib/v2/buyer-types";

export const MAX_SELECTION_QTY = 20;

// Reads a stored selection defensively; anything unexpected is dropped.
export function readSelection(raw: unknown): BuyerSelection | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const { colour, qty } = raw as { colour?: unknown; qty?: unknown };
  const out: BuyerSelection = {};
  if (typeof colour === "string" && colour.trim()) out.colour = colour.trim().slice(0, 40);
  if (typeof qty === "number" && Number.isInteger(qty) && qty >= 1 && qty <= MAX_SELECTION_QTY) out.qty = qty;
  return out.colour || out.qty ? out : null;
}

// Keeps only valid values: the colour must be one the product offers, the quantity a whole number from 1 to 20.
export function sanitizeSelection(raw: unknown, productColours: string[]): BuyerSelection | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const { colour, qty } = raw as { colour?: unknown; qty?: unknown };
  const out: BuyerSelection = {};
  if (typeof colour === "string" && productColours.includes(colour)) out.colour = colour;
  if (typeof qty === "number" && Number.isInteger(qty) && qty >= 1 && qty <= MAX_SELECTION_QTY) out.qty = qty;
  return out.colour || out.qty ? out : null;
}
