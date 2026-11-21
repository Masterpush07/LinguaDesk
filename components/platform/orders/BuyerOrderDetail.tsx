"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Check, ExternalLink, MessageCircle, RefreshCw, Truck } from "lucide-react";
import { CurrencyNote, Price, usePrefs } from "@/components/platform/Prefs";
import { api, ApiError } from "@/lib/v2/client";
import type { BuyerOrder } from "@/lib/v2/buyer-types";
import { trackingUrl } from "@/lib/v2/tracking";
import CopyTracking from "./CopyTracking";
import { CancelOrder, ReturnSection, ReviewSection } from "./OrderAfterSales";
import { ORDER_STEPS, OrderStatusPill, shortDate } from "./orderStatus";

type State = { kind: "loading" } | { kind: "missing" } | { kind: "error"; message: string } | { kind: "ready"; order: BuyerOrder };

const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2";

export default function BuyerOrderDetail({ id }: { id: string }) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [confirming, setConfirming] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const { currency } = usePrefs();

  const load = useCallback(async () => {
    try {
      setState({ kind: "ready", order: await api<BuyerOrder>(`/api/buyer/orders/${encodeURIComponent(id)}`) });
    } catch (err) {
      if (err instanceof ApiError && (err.status === 404 || err.status === 401)) setState({ kind: "missing" });
      else setState({ kind: "error", message: err instanceof Error ? err.message : "This order could not be loaded." });
    }
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [load]);

  async function confirm() {
    setConfirming(true);
    setActionError(null);
    try {
      await api<{ ok: boolean }>(`/api/buyer/orders/${encodeURIComponent(id)}/confirm`, { method: "POST", json: {} });
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "The order could not be confirmed. Please try again.");
    } finally {
      setConfirming(false);
    }
  }

  if (state.kind === "loading") {
    return (
      <div role="status" aria-busy="true" data-testid="order-loading" className="space-y-4">
        <span className="sr-only">Loading order</span>
        <div className="h-8 w-1/3 animate-pulse rounded-lg bg-slate-200 motion-reduce:animate-none" />
        <div className="h-64 animate-pulse rounded-2xl bg-slate-100 motion-reduce:animate-none" />
      </div>
    );
  }

  if (state.kind === "missing") {
    return (
      <div data-testid="order-missing" className="flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
        <p className="font-heading text-lg font-semibold text-slate-900">We could not find this order</p>
        <p className="mt-1 max-w-sm text-sm text-slate-500">It may belong to a different visitor or the link may be out of date.</p>
        <Link href="/orders" data-testid="order-missing-back" className={`mt-4 rounded-full bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 ${FOCUS}`}>
          Back to my orders
        </Link>
      </div>
    );
  }

  if (state.kind === "error") {
    return (
      <div role="alert" data-testid="order-error" className="flex flex-col items-center rounded-2xl border border-red-200 bg-red-50 px-6 py-10 text-center">
        <p className="font-heading text-base font-semibold text-red-900">This order could not be loaded</p>
        <p className="mt-1 max-w-sm text-sm text-red-800">{state.message}</p>
        <button
          type="button"
          onClick={() => {
            setState({ kind: "loading" });
            void load();
          }}
          data-testid="order-retry-btn"
          className={`mt-4 inline-flex items-center gap-1.5 rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 ${FOCUS}`}
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" /> Try again
        </button>
      </div>
    );
  }

  const { order } = state;
  const cancelled = order.status === "cancelled";
  const currentIndex = ORDER_STEPS.findIndex((s) => s.key === order.status);
  const hasCourier = !!(order.courier || order.tracking);
  const trackUrl = trackingUrl(order.courier, order.tracking);
  const timeOf = (key: string) => (key === "proposed" ? order.createdAt : key === "confirmed" ? order.confirmedAt : null);

  return (
    <>
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-slate-500" data-testid="order-breadcrumb">
        <Link href="/orders" data-testid="order-breadcrumb-orders" className={`rounded hover:text-indigo-700 ${FOCUS}`}>
          My orders
        </Link>
        <span aria-hidden="true"> / </span>
        <span className="text-slate-900" aria-current="page">
          {order.id}
        </span>
      </nav>

      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl" data-testid="order-title">
            Order from {order.seller.name}
          </h1>
          <p className="mt-1 text-sm text-slate-500" data-testid="order-meta">
            Order {order.id} · Placed {shortDate(order.createdAt)}
            {order.confirmedAt ? ` · Confirmed ${shortDate(order.confirmedAt)}` : ""}
          </p>
        </div>
        <OrderStatusPill status={order.status} />
      </header>

      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
        <section aria-labelledby="tracking-heading" className="rounded-2xl border border-slate-200 bg-white p-6 lg:col-span-7" data-testid="order-tracking">
          <h2 id="tracking-heading" className="font-heading text-lg font-semibold text-slate-900">
            Order status
          </h2>
          {cancelled ? (
            <div data-testid="order-cancelled-note" className="mt-4 space-y-1 rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
              <p role="status">
                This order was cancelled{order.cancelledAt ? ` on ${shortDate(order.cancelledAt)}` : ""}. If you have questions, contact the shop in your conversation.
              </p>
              {order.cancelReason && (
                <p data-testid="order-cancel-reason-shown" className="text-slate-600">
                  Reason: {order.cancelReason}
                </p>
              )}
            </div>
          ) : (
            <ol className="mt-5" data-testid="order-timeline">
              {ORDER_STEPS.map((s, i) => {
                const state = i < currentIndex ? "done" : i === currentIndex ? "current" : "upcoming";
                const done = state === "done" || (state === "current" && order.status === "delivered");
                const last = i === ORDER_STEPS.length - 1;
                const at = timeOf(s.key);
                return (
                  <li key={s.key} data-testid={`order-step-${s.key}`} data-state={done ? "done" : state} aria-current={state === "current" ? "step" : undefined} className="relative flex gap-4 pb-6 last:pb-0">
                    {!last && <span aria-hidden="true" className={`absolute left-[15px] top-8 h-[calc(100%-2rem)] w-0.5 ${i < currentIndex ? "bg-indigo-500" : "bg-slate-200"}`} />}
                    <span
                      aria-hidden="true"
                      className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 ${
                        done ? "border-indigo-600 bg-indigo-600 text-white" : state === "current" ? "border-cyan-500 bg-white text-cyan-600" : "border-slate-200 bg-white text-slate-300"
                      }`}
                    >
                      {done ? <Check className="h-4 w-4" /> : state === "current" ? <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-cyan-500 motion-reduce:animate-none" /> : <span className="h-2 w-2 rounded-full bg-slate-200" />}
                    </span>
                    <div className="min-w-0 flex-1 pt-0.5">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                        <p className={`text-sm font-semibold ${state === "upcoming" ? "text-slate-500" : "text-slate-900"}`}>
                          {s.label}
                          {state === "current" && !done && <span className="ml-2 rounded-full bg-cyan-50 px-2 py-0.5 text-[11px] font-semibold text-cyan-700">Current step</span>}
                        </p>
                        {at && (
                          <p className="text-xs text-slate-500" data-testid={`order-step-time-${s.key}`}>
                            {shortDate(at)}
                          </p>
                        )}
                      </div>
                      <p className={`text-sm ${state === "upcoming" ? "text-slate-500" : "text-slate-600"}`}>{s.detail}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        <div className="space-y-6 lg:col-span-5">
          <section aria-labelledby="courier-heading" className="rounded-2xl border border-slate-200 bg-white p-5" data-testid="order-courier-card">
            <h2 id="courier-heading" className="flex items-center gap-2 font-heading text-base font-semibold text-slate-900">
              <Truck className="h-4 w-4 text-cyan-600" aria-hidden="true" /> Courier
            </h2>
            {hasCourier ? (
              <dl className="mt-3 space-y-2 text-sm">
                {order.courier && (
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500">Carrier</dt>
                    <dd className="font-medium text-slate-900" data-testid="order-courier">
                      {order.courier}
                    </dd>
                  </div>
                )}
                {order.tracking && (
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-slate-500">Tracking number</dt>
                    <dd className="flex flex-wrap items-center justify-end gap-2">
                      <span className="font-mono text-slate-900" data-testid="order-tracking-number">
                        {order.tracking}
                      </span>
                      <CopyTracking value={order.tracking} />
                      {trackUrl && (
                        <a
                          href={trackUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          data-testid="order-track-parcel-link"
                          className={`inline-flex items-center gap-1 rounded text-xs font-medium text-indigo-700 hover:underline ${FOCUS}`}
                        >
                          Track this parcel <ExternalLink className="h-3 w-3" aria-hidden="true" />
                          <span className="sr-only"> (opens in a new tab)</span>
                        </a>
                      )}
                    </dd>
                  </div>
                )}
              </dl>
            ) : (
              <p data-testid="order-courier-empty" className="mt-3 text-sm text-slate-600">
                The shop has not added courier details yet. They appear here as soon as the shop enters them.
              </p>
            )}
          </section>

          <section aria-labelledby="items-heading" className="rounded-2xl border border-slate-200 bg-white p-5" data-testid="order-items-card">
            <h2 id="items-heading" className="font-heading text-base font-semibold text-slate-900">
              Items
            </h2>
            {order.card ? (
              <>
                <ul className="mt-3 divide-y divide-slate-100">
                  {order.card.lines.map((l, i) => (
                    <li key={`${l.name}-${i}`} data-testid={`order-item-${i}`} className="flex items-center justify-between gap-3 py-2 text-sm">
                      <span className="min-w-0 text-slate-700">
                        {l.name} <span className="text-slate-500">× {l.qty}</span>
                      </span>
                      <Price usd={l.amount} className="font-medium text-slate-900" />
                    </li>
                  ))}
                </ul>
                <dl className="mt-3 space-y-1.5 border-t border-slate-100 pt-3 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-slate-500">Subtotal</dt>
                    <dd className="text-slate-900">
                      <Price usd={order.card.subtotal} />
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-slate-500">Shipping</dt>
                    <dd data-testid="order-shipping" className="text-slate-900">
                      {order.card.shipping === 0 ? "Free" : <Price usd={order.card.shipping} />}
                    </dd>
                  </div>
                  <div className="flex justify-between pt-1">
                    <dt className="font-semibold text-slate-900">Total</dt>
                    <dd data-testid="order-total" className="font-heading text-lg font-semibold text-slate-900">
                      <Price usd={order.total} />
                    </dd>
                  </div>
                </dl>
              </>
            ) : (
              <p className="mt-3 text-sm text-slate-600">
                Item details are not available. Total:{" "}
                <span data-testid="order-total">
                  <Price usd={order.total} />
                </span>
              </p>
            )}
            {currency === "USD" ? (
              <p className="mt-3 text-xs text-slate-500">Amounts are in US dollars, as priced by the shop.</p>
            ) : (
              <CurrencyNote className="mt-3" testId="order-currency-note" />
            )}
          </section>

          <section aria-label="Order actions" className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5" data-testid="order-help-card">
            {order.status === "proposed" && (
              <button
                type="button"
                onClick={() => void confirm()}
                disabled={confirming}
                data-testid="order-confirm-btn"
                className={`inline-flex w-full items-center justify-center rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 motion-reduce:transition-none disabled:cursor-not-allowed disabled:bg-slate-300 ${FOCUS}`}
              >
                {confirming ? "Confirming..." : (order.card?.labels.confirm ?? "Confirm order")}
              </button>
            )}
            {actionError && (
              <p role="alert" data-testid="order-confirm-error" className="text-sm text-red-700">
                {actionError}
              </p>
            )}
            <CancelOrder order={order} onDone={load} />
            <Link
              href={`/chat/${order.seller.slug}`}
              data-testid="order-contact-seller"
              className={`inline-flex w-full items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 motion-reduce:transition-none ${FOCUS}`}
            >
              <MessageCircle className="h-4 w-4" aria-hidden="true" /> Contact the shop
            </Link>
          </section>

          <ReturnSection order={order} onDone={load} />
          <ReviewSection order={order} onDone={load} />
        </div>
      </div>
    </>
  );
}
