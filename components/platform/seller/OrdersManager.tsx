"use client";

import { useState } from "react";
import { CheckCircle2, ExternalLink, Eye, PackageCheck, Truck } from "lucide-react";
import { BTN_DANGER, BTN_GHOST, BTN_PRIMARY, Card, Dialog, ErrorBlock, FieldError, FOCUS, INPUT, Label, LoadingBlock, Notice } from "@/components/platform/seller/ui";
import { EmptyState, NextAction } from "@/components/platform/ui";
import { api } from "@/lib/v2/client";
import { trackingUrl } from "@/lib/v2/tracking";
import { errorMessage, useApi } from "@/lib/v2/seller-hooks";
import { formatDateTime, formatUsd, ORDER_STATUSES, type OrderDto, type OrderStatus } from "@/lib/v2/seller-types";

const STATUS_LABEL: Record<OrderStatus, string> = {
  proposed: "Awaiting customer",
  confirmed: "Confirmed",
  packed: "Packed",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

const STATUS_STYLE: Record<OrderStatus, string> = {
  proposed: "bg-slate-100 text-slate-600 ring-slate-200",
  confirmed: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  packed: "bg-amber-50 text-amber-700 ring-amber-200",
  shipped: "bg-cyan-50 text-cyan-700 ring-cyan-200",
  delivered: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  cancelled: "bg-red-50 text-red-700 ring-red-200",
};

const FORWARD: Partial<Record<OrderStatus, { to: OrderStatus; label: string }>> = {
  confirmed: { to: "packed", label: "Mark as packed" },
  packed: { to: "shipped", label: "Mark as shipped" },
  shipped: { to: "delivered", label: "Mark as delivered" },
};
const CANCELLABLE: OrderStatus[] = ["proposed", "confirmed", "packed"];

function StatusPill({ order }: { order: OrderDto }) {
  return (
    <span data-testid={`order-status-${order.id}`} className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${STATUS_STYLE[order.status]}`}>
      {STATUS_LABEL[order.status]}
    </span>
  );
}

export default function OrdersManager() {
  const { data, error, loading, reload, update } = useApi<OrderDto[]>("/api/desk/orders");
  const [filter, setFilter] = useState<OrderStatus | "all">("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [actionError, setActionError] = useState("");
  const [courier, setCourier] = useState("");
  const [tracking, setTracking] = useState("");
  const [detailError, setDetailError] = useState("");

  const selected = data?.find((o) => o.id === openId) ?? null;
  const counts = Object.fromEntries(ORDER_STATUSES.map((s) => [s, data?.filter((o) => o.status === s).length ?? 0])) as Record<OrderStatus, number>;
  const rows = data?.filter((o) => filter === "all" || o.status === filter) ?? [];

  const openDetails = (o: OrderDto) => {
    setCourier(o.courier ?? "");
    setTracking(o.tracking ?? "");
    setDetailError("");
    setOpenId(o.id);
  };

  // Sends the change, then replaces the row with what the server stored.
  const send = async (o: OrderDto, changes: { status?: OrderStatus; courier?: string; tracking?: string }, message: string, inDrawer: boolean) => {
    setBusyId(o.id);
    setActionError("");
    setDetailError("");
    try {
      const saved = await api<OrderDto>(`/api/desk/orders/${o.id}`, { method: "PATCH", json: changes });
      update((list) => list.map((x) => (x.id === o.id ? saved : x)));
      const warning = saved.notified === false ? " The customer message could not be sent, so contact the customer directly." : saved.notified ? " The customer was notified in the chat." : "";
      setNotice(`${message}${warning}`);
      setConfirmCancel(null);
    } catch (err) {
      setNotice("");
      if (inDrawer) setDetailError(errorMessage(err));
      else setActionError(`Order ${o.id}: ${errorMessage(err)}`);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <div role="group" aria-label="Filter orders by status" className="mb-4 flex flex-wrap gap-2" data-testid="order-filter">
        {(["all", ...ORDER_STATUSES] as const).map((s) => {
          const count = s === "all" ? (data?.length ?? 0) : counts[s];
          const active = filter === s;
          return (
            <button
              key={s}
              type="button"
              aria-pressed={active}
              onClick={() => setFilter(s)}
              data-testid={`order-filter-${s}`}
              className={`rounded-full px-3 py-1.5 text-sm font-medium ring-1 ${active ? "bg-indigo-600 text-white ring-indigo-600" : "bg-white text-slate-600 ring-slate-300 hover:bg-slate-50"} ${FOCUS}`}
            >
              {s === "all" ? "All orders" : STATUS_LABEL[s]}
              {data && <span className={`ml-1.5 text-xs ${active ? "text-indigo-100" : "text-slate-400"}`}>{count}</span>}
            </button>
          );
        })}
      </div>
      <Notice message={notice} testId="orders-confirmation" />
      {actionError && (
        <p role="alert" data-testid="orders-action-error" className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">
          {actionError}
        </p>
      )}

      {loading && <LoadingBlock label="Loading orders" testId="orders-loading" />}
      {error && !data && <ErrorBlock message={error} onRetry={reload} testId="orders-error" />}
      {data && data.length === 0 && (
        <EmptyState title="No orders yet" text="When a customer confirms an order card sent in a chat, it appears here ready to pack and ship." href="/agent" cta="Open the inbox" />
      )}
      {data && data.length > 0 && rows.length === 0 && (
        <p data-testid="orders-filter-empty" className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          No orders match this filter.
        </p>
      )}

      {rows.length > 0 && (
        <ul className="space-y-3" data-testid="order-list">
          {rows.map((o) => {
            const next = FORWARD[o.status];
            const busy = busyId === o.id;
            return (
              <li key={o.id} data-testid={`order-${o.id}`}>
                <Card className="!p-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-900">
                        <span className="font-mono">{o.id}</span>
                        <StatusPill order={o} />
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {o.buyerLabel} · {formatDateTime(o.createdAt)} · {o.lines.reduce((n, l) => n + l.qty, 0)} items
                      </p>
                      {(o.courier || o.tracking) && (
                        <p className="mt-0.5 text-xs text-slate-600" data-testid={`order-courier-${o.id}`}>
                          {[o.courier, o.tracking && `Tracking ${o.tracking}`].filter(Boolean).join(" · ")}
                        </p>
                      )}
                    </div>
                    <p className="font-heading text-lg font-semibold text-slate-900" data-testid={`order-total-${o.id}`}>{formatUsd(o.total)}</p>
                    <div className="flex flex-wrap items-center gap-2">
                      {o.status === "proposed" && <span className="text-xs text-slate-500">Waiting for the customer to confirm</span>}
                      {next && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => (next.to === "shipped" ? openDetails(o) : send(o, { status: next.to }, `Order ${o.id} is now ${next.to}.`, false))}
                          data-testid={`order-advance-${o.id}`}
                          className={`${BTN_PRIMARY} !px-3 !py-1.5`}
                        >
                          {next.to === "shipped" ? <Truck className="h-4 w-4" aria-hidden="true" /> : <PackageCheck className="h-4 w-4" aria-hidden="true" />}
                          {next.to === "shipped" ? "Add courier and ship" : next.label}
                        </button>
                      )}
                      {CANCELLABLE.includes(o.status) &&
                        (confirmCancel === o.id ? (
                          <span className="inline-flex flex-wrap items-center gap-2" data-testid={`order-cancel-confirm-${o.id}`}>
                            <span className="text-xs text-slate-600">Cancel this order?</span>
                            <button type="button" disabled={busy} onClick={() => send(o, { status: "cancelled" }, `Order ${o.id} was cancelled.`, false)} data-testid={`order-cancel-yes-${o.id}`} className={`${BTN_DANGER} !px-3 !py-1.5`}>Yes, cancel</button>
                            <button type="button" onClick={() => setConfirmCancel(null)} data-testid={`order-cancel-no-${o.id}`} className={`${BTN_GHOST} !px-3 !py-1.5`}>Keep order</button>
                          </span>
                        ) : (
                          <button type="button" onClick={() => setConfirmCancel(o.id)} data-testid={`order-cancel-${o.id}`} className={`rounded-full px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 ${FOCUS}`}>
                            Cancel order
                          </button>
                        ))}
                      <button type="button" onClick={() => openDetails(o)} data-testid={`order-details-${o.id}`} className={`${BTN_GHOST} !px-3 !py-1.5`}>
                        <Eye className="h-4 w-4" aria-hidden="true" />
                        Details
                      </button>
                    </div>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-6">
        <NextAction title="Next: keep stock accurate" text="Check your inventory after packing so customers only see what you can ship." href="/seller/inventory" cta="Go to inventory" />
      </div>

      {selected && (
        <Dialog side title={`Order ${selected.id}`} description={`${selected.buyerLabel} · placed ${formatDateTime(selected.createdAt)}`} onClose={() => setOpenId(null)} testId="order-drawer">
          <div className="space-y-5">
            <div className="flex items-center gap-2">
              <StatusPill order={selected} />
              {selected.confirmedAt && <span className="text-xs text-slate-500">Confirmed {formatDateTime(selected.confirmedAt)}</span>}
            </div>

            <section aria-label="Items in this order">
              <h3 className="text-sm font-semibold text-slate-900">Items</h3>
              {selected.lines.length === 0 ? (
                <p data-testid="order-lines-empty" className="mt-1 text-sm text-slate-500">No item details were stored for this order.</p>
              ) : (
                <table className="mt-2 w-full text-sm" data-testid="order-lines">
                  <thead className="text-xs text-slate-500">
                    <tr>
                      <th scope="col" className="py-1 text-left font-medium">Item</th>
                      <th scope="col" className="py-1 text-right font-medium">Qty</th>
                      <th scope="col" className="py-1 text-right font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selected.lines.map((l, i) => (
                      <tr key={`${l.name}-${i}`} data-testid={`order-line-${i}`}>
                        <td className="py-1.5 text-slate-800">{l.name}</td>
                        <td className="py-1.5 text-right tabular-nums">{l.qty}</td>
                        <td className="py-1.5 text-right tabular-nums">{formatUsd(l.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t border-slate-200 text-sm">
                    {selected.subtotal !== null && (
                      <tr>
                        <td colSpan={2} className="py-1 text-slate-600">Subtotal</td>
                        <td className="py-1 text-right tabular-nums" data-testid="order-subtotal">{formatUsd(selected.subtotal)}</td>
                      </tr>
                    )}
                    {selected.shipping !== null && (
                      <tr>
                        <td colSpan={2} className="py-1 text-slate-600">Shipping</td>
                        <td className="py-1 text-right tabular-nums" data-testid="order-shipping">{selected.shipping === 0 ? "Free" : formatUsd(selected.shipping)}</td>
                      </tr>
                    )}
                    <tr className="font-semibold">
                      <td colSpan={2} className="py-1">Total</td>
                      <td className="py-1 text-right tabular-nums" data-testid="order-drawer-total">{formatUsd(selected.total)}</td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </section>

            <section aria-label="Courier details">
              <h3 className="text-sm font-semibold text-slate-900">Courier and tracking</h3>
              {selected.status === "proposed" || selected.status === "cancelled" ? (
                <p data-testid="order-courier-unavailable" className="mt-1 text-sm text-slate-500">
                  Courier details can be added once the customer has confirmed the order and it has not been cancelled.
                </p>
              ) : (
                <>
                  <p className="mt-1 text-xs text-slate-500">You enter these yourself from your courier. The customer receives them when you mark the order as shipped.</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="od-courier">Courier</Label>
                      <input id="od-courier" value={courier} maxLength={60} onChange={(e) => setCourier(e.target.value)} data-testid="order-courier-input" className={INPUT} placeholder="DHL Express" />
                    </div>
                    <div>
                      <Label htmlFor="od-tracking">Tracking number</Label>
                      <input id="od-tracking" value={tracking} maxLength={80} onChange={(e) => setTracking(e.target.value)} data-testid="order-tracking-input" className={INPUT} placeholder="JD0146000" />
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busyId === selected.id || (courier.trim() === (selected.courier ?? "") && tracking.trim() === (selected.tracking ?? ""))}
                      onClick={() => send(selected, { courier: courier.trim(), tracking: tracking.trim() }, `Courier details for order ${selected.id} were saved.`, true)}
                      data-testid="order-save-courier"
                      className={BTN_GHOST}
                    >
                      Save courier details
                    </button>
                    {selected.status === "packed" && (
                      <button
                        type="button"
                        disabled={busyId === selected.id}
                        onClick={() => send(selected, { status: "shipped", courier: courier.trim(), tracking: tracking.trim() }, `Order ${selected.id} is now shipped.`, true)}
                        data-testid="order-ship-now"
                        className={BTN_PRIMARY}
                      >
                        <Truck className="h-4 w-4" aria-hidden="true" />
                        Mark as shipped
                      </button>
                    )}
                    {FORWARD[selected.status] && selected.status !== "packed" && (
                      <button
                        type="button"
                        disabled={busyId === selected.id}
                        onClick={() => send(selected, { status: FORWARD[selected.status]!.to }, `Order ${selected.id} is now ${FORWARD[selected.status]!.to}.`, true)}
                        data-testid="order-drawer-advance"
                        className={BTN_PRIMARY}
                      >
                        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                        {FORWARD[selected.status]!.label}
                      </button>
                    )}
                  </div>
                  {selected.status === "confirmed" && (
                    <p className="mt-2 text-xs text-slate-500">Mark the order as packed first. Shipping is available once it is packed.</p>
                  )}
                </>
              )}
              {selected.tracking && (
                <a
                  href={trackingUrl(selected.courier, selected.tracking) ?? undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="order-track-link"
                  className={`mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-indigo-700 underline-offset-2 hover:underline ${FOCUS}`}
                >
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  Track this parcel
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              )}
              <FieldError id="order-detail-error" message={detailError} testId="order-detail-error" />
            </section>
            <Notice message={notice} testId="order-drawer-confirmation" />
          </div>
        </Dialog>
      )}
    </div>
  );
}
