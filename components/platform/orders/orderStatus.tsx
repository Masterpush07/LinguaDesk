import type { OrderStatus } from "@/lib/v2/buyer-types";

// Presentation of the real order status. The seller moves an order through these states by hand.

export const ORDER_STATUS_LABEL: Record<OrderStatus, { label: string; cls: string }> = {
  proposed: { label: "Awaiting your confirmation", cls: "bg-amber-50 text-amber-700 ring-amber-200" },
  confirmed: { label: "Confirmed", cls: "bg-indigo-50 text-indigo-700 ring-indigo-200" },
  packed: { label: "Packed", cls: "bg-indigo-50 text-indigo-700 ring-indigo-200" },
  shipped: { label: "Shipped", cls: "bg-cyan-50 text-cyan-700 ring-cyan-200" },
  delivered: { label: "Delivered", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  cancelled: { label: "Cancelled", cls: "bg-slate-100 text-slate-600 ring-slate-200" },
};

export const ORDER_STEPS: { key: Exclude<OrderStatus, "cancelled">; label: string; detail: string }[] = [
  { key: "proposed", label: "Order proposed", detail: "The shop sent you this order. Confirm it in the conversation when the details are correct." },
  { key: "confirmed", label: "Order confirmed", detail: "You confirmed the order. The shop arranges payment and shipping with you in the conversation." },
  { key: "packed", label: "Packed", detail: "The shop has packed your order." },
  { key: "shipped", label: "Shipped", detail: "Your order has been handed to the courier." },
  { key: "delivered", label: "Delivered", detail: "Your order has arrived." },
];

export const isInProgress = (s: OrderStatus) => s !== "delivered" && s !== "cancelled";

export const shortDate = (iso: string) => new Date(iso).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });

export function OrderStatusPill({ status }: { status: OrderStatus }) {
  const s = ORDER_STATUS_LABEL[status];
  return (
    <span data-testid={`order-status-${status}`} className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${s.cls}`}>
      {s.label}
    </span>
  );
}
