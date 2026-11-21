import { readDelivery } from "@/lib/v2/delivery";
import { iso, buyerLabel } from "@/lib/v2/seller-api";
import type { OrderDto, OrderStatus } from "@/lib/v2/seller-types";

type Row = Record<string, unknown>;

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

// Forward-only lifecycle. proposed -> confirmed is the buyer's action, so the seller can never perform it.
export const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  confirmed: "packed",
  packed: "shipped",
  shipped: "delivered",
};
export const CANCELLABLE: OrderStatus[] = ["proposed", "confirmed", "packed"];

export function checkTransition(from: OrderStatus, to: OrderStatus): string | null {
  if (from === to) return null;
  if (from === "proposed" && to === "confirmed") return "Only the customer can confirm an order. It is still waiting for their confirmation.";
  if (to === "cancelled") return CANCELLABLE.includes(from) ? null : `An order that is ${from} can no longer be cancelled.`;
  if (NEXT_STATUS[from] === to) return null;
  return `An order cannot move from ${from} to ${to}.`;
}

export function orderDto(r: Row): OrderDto {
  const card = (r.card && typeof r.card === "object" ? r.card : {}) as { lines?: unknown; subtotal?: unknown; shipping?: unknown };
  const lines = (Array.isArray(card.lines) ? card.lines : [])
    .map((l) => (l && typeof l === "object" ? (l as Record<string, unknown>) : {}))
    .map((l) => ({ name: typeof l.name === "string" ? l.name : "Item", qty: num(l.qty) ?? 0, amount: num(l.amount) ?? 0 }));
  return {
    id: r.id as string,
    status: r.status as OrderStatus,
    total: r.total as number,
    subtotal: num(card.subtotal),
    shipping: num(card.shipping),
    createdAt: iso(r.created_at) ?? "",
    confirmedAt: iso(r.confirmed_at),
    courier: (r.courier as string | null) ?? null,
    tracking: (r.tracking as string | null) ?? null,
    buyerLabel: buyerLabel(r.buyer_id as string),
    threadId: (r.thread_id as string | null) ?? null,
    lines,
    delivery: readDelivery(r.delivery),
    paidAt: iso(r.paid_at),
  };
}

// The courtesy message is factual only: order number, new status, and the courier details the seller typed in.
export function courtesyText(order: { id: string; courier: string | null; tracking: string | null }, status: "shipped" | "delivered"): string {
  if (status === "delivered") return `Order ${order.id} has been marked as delivered.`;
  const details = [order.courier && `Courier: ${order.courier}.`, order.tracking && `Tracking number: ${order.tracking}.`].filter(Boolean).join(" ");
  return [`Order ${order.id} has been shipped.`, details].filter(Boolean).join(" ");
}
