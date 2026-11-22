"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ChevronRight, Package, RefreshCw } from "lucide-react";
import { EmptyState } from "@/components/platform/ui";
import { api } from "@/lib/v2/client";
import type { BuyerOrder } from "@/lib/v2/buyer-types";
import { isInProgress, OrderStatusPill, shortDate } from "./orderStatus";

type Tab = "all" | "progress" | "delivered";
type State = { kind: "loading" } | { kind: "error"; message: string } | { kind: "ready"; orders: BuyerOrder[] };

const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "progress", label: "In progress" },
  { key: "delivered", label: "Delivered" },
];
const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2";

export default function BuyerOrders() {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [tab, setTab] = useState<Tab>("all");

  const load = useCallback(async () => {
    try {
      setState({ kind: "ready", orders: await api<BuyerOrder[]>("/api/buyer/orders") });
    } catch (err) {
      setState({ kind: "error", message: err instanceof Error ? err.message : "Your orders could not be loaded." });
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  if (state.kind === "loading") {
    return (
      <div role="status" aria-busy="true" data-testid="orders-loading" className="space-y-4">
        <span className="sr-only">Loading your orders</span>
        {[0, 1].map((i) => (
          <div key={i} className="h-36 animate-pulse rounded-2xl bg-slate-100 motion-reduce:animate-none" />
        ))}
      </div>
    );
  }

  if (state.kind === "error") {
    return (
      <div role="alert" data-testid="orders-error" className="flex flex-col items-center rounded-2xl border border-red-200 bg-red-50 px-6 py-10 text-center">
        <p className="font-heading text-base font-semibold text-red-900">Your orders could not be loaded</p>
        <p className="mt-1 max-w-sm text-sm text-red-800">{state.message}</p>
        <button
          type="button"
          onClick={() => {
            setState({ kind: "loading" });
            void load();
          }}
          data-testid="orders-retry-btn"
          className={`mt-4 inline-flex items-center gap-1.5 rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 ${FOCUS}`}
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" /> Try again
        </button>
      </div>
    );
  }

  const { orders } = state;
  const counts: Record<Tab, number> = {
    all: orders.length,
    progress: orders.filter((o) => isInProgress(o.status)).length,
    delivered: orders.filter((o) => o.status === "delivered").length,
  };
  const shown = orders.filter((o) => (tab === "all" ? true : tab === "delivered" ? o.status === "delivered" : isInProgress(o.status)));

  return (
    <div>
      <div role="tablist" aria-label="Filter orders" className="flex gap-1 rounded-full border border-slate-200 bg-white p-1 sm:inline-flex" data-testid="orders-tabs">
        {TABS.map((t) => {
          const active = t.key === tab;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              id={`orders-tab-${t.key}`}
              aria-selected={active}
              aria-controls="orders-panel"
              data-testid={`orders-tab-${t.key}`}
              onClick={() => setTab(t.key)}
              className={`flex-1 rounded-full px-4 py-1.5 text-sm font-medium transition motion-reduce:transition-none ${FOCUS} ${active ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}
            >
              {t.label} <span className={active ? "text-indigo-100" : "text-slate-500"}>({counts[t.key]})</span>
            </button>
          );
        })}
      </div>

      <div id="orders-panel" role="tabpanel" aria-labelledby={`orders-tab-${tab}`} className="mt-5" data-testid="orders-panel">
        <p className="sr-only" aria-live="polite" data-testid="orders-count-live">
          Showing {shown.length} {shown.length === 1 ? "order" : "orders"}
        </p>
        {shown.length === 0 ? (
          orders.length === 0 ? (
            <EmptyState title="You have no orders yet" text="When a shop proposes an order in a conversation and you confirm it, it appears here with its status." href="/marketplace" cta="Discover shops" />
          ) : (
            <EmptyState
              title={tab === "delivered" ? "Nothing delivered yet" : "No orders in progress"}
              text={tab === "delivered" ? "Delivered orders will appear here." : "All of your orders have been delivered or cancelled."}
              href="/marketplace"
              cta="Discover shops"
            />
          )
        ) : (
          <ul className="space-y-4" data-testid="orders-list">
            {shown.map((o) => (
              <li key={o.id}>
                <Link
                  href={`/orders/${encodeURIComponent(o.id)}`}
                  data-testid={`order-card-${o.id}`}
                  className={`group flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-lg motion-reduce:transition-none motion-reduce:hover:translate-y-0 ${FOCUS}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600" aria-hidden="true">
                        <Package className="h-5 w-5" />
                      </span>
                      <div>
                        <p className="font-heading text-base font-semibold text-slate-900 group-hover:text-indigo-700">{o.seller.name}</p>
                        <p className="text-sm text-slate-500">Order {o.id}</p>
                      </div>
                    </div>
                    <OrderStatusPill status={o.status} />
                  </div>
                  {o.card && (
                    <p className="text-sm text-slate-700" data-testid={`order-items-${o.id}`}>
                      {o.card.lines.map((l) => `${l.qty} × ${l.name}`).join(", ")}
                    </p>
                  )}
                  <div className="flex flex-wrap items-end justify-between gap-3 border-t border-slate-100 pt-3 text-sm text-slate-500">
                    <span data-testid={`order-placed-${o.id}`}>Placed {shortDate(o.createdAt)}</span>
                    <div className="flex items-center gap-2">
                      <span data-testid={`order-total-${o.id}`} className="font-heading text-lg font-semibold text-slate-900">
                        ${o.total}
                      </span>
                      <span className="inline-flex items-center text-sm font-medium text-indigo-600">
                        View status <ChevronRight className="h-4 w-4" aria-hidden="true" />
                      </span>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
