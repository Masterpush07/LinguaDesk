"use client";

import { useEffect, useMemo, useState } from "react";
import { PackagePlus, Send, X } from "lucide-react";
import { ErrorNotice, focusRing, Loading } from "@/components/platform/agent/desk-ui";
import { api } from "@/lib/v2/client";
import { formatUsd } from "@/lib/v2/desk-client";
import type { CatalogItem } from "@/lib/v2/desk-types";

type Props = { threadId: string; onSent: (message: string) => void; onClose: () => void };
type Load = { status: "loading" } | { status: "ready"; items: CatalogItem[] } | { status: "error"; message: string };

const MAX_QTY = 20;

// Builds an order card from the shop's own products. Prices and shipping are calculated on the server when the card is sent.
export default function OrderBuilder({ threadId, onSent, onClose }: Props) {
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    api<CatalogItem[]>(`/api/desk/threads/${threadId}/catalog`)
      .then((items) => alive && setLoad({ status: "ready", items }))
      .catch((err: unknown) => alive && setLoad({ status: "error", message: err instanceof Error ? err.message : "Products could not be loaded." }));
    return () => {
      alive = false;
    };
  }, [threadId, attempt]);

  const lines = useMemo(() => Object.entries(qty).filter(([, n]) => n > 0).map(([id, n]) => ({ id, qty: n })), [qty]);
  const subtotal = useMemo(() => {
    if (load.status !== "ready") return 0;
    return lines.reduce((sum, l) => sum + (load.items.find((p) => p.id === l.id)?.priceUsd ?? 0) * l.qty, 0);
  }, [lines, load]);

  async function send() {
    setSending(true);
    setError("");
    try {
      await api(`/api/desk/threads/${threadId}/order`, { method: "POST", json: { lines } });
      onSent("Order card sent. The buyer can confirm it in the chat.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "The order could not be sent.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div data-testid="order-builder" className="rounded-lg border border-slate-700 bg-[#111827] p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-medium text-slate-100">Order card</p>
        <button type="button" onClick={onClose} aria-label="Close the order builder" data-testid="order-builder-close-btn" className={`rounded-md p-1 text-slate-400 hover:bg-slate-800 hover:text-white ${focusRing}`}>
          <X className="h-4 w-4" />
        </button>
      </div>
      {load.status === "loading" && <Loading label="Loading products" testId="order-builder-loading" />}
      {load.status === "error" && <ErrorNotice message={load.message} onRetry={() => { setLoad({ status: "loading" }); setAttempt((n) => n + 1); }} testId="order-builder-error" />}
      {load.status === "ready" && load.items.length === 0 && (
        <p data-testid="order-builder-empty" className="py-4 text-center text-sm text-slate-400">
          This shop has no active products. Add products in the seller studio first.
        </p>
      )}
      {load.status === "ready" && load.items.length > 0 && (
        <>
          <ul className="space-y-2">
            {load.items.map((p) => {
              const out = p.stock <= 0;
              const max = Math.min(MAX_QTY, Math.max(p.stock, 0));
              return (
                <li key={p.id} data-testid={`order-product-${p.id}`} className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-slate-100">{p.name}</p>
                    <p className="text-xs text-slate-400">
                      {formatUsd(p.priceUsd)} {out ? "· Out of stock" : `· ${p.stock} in stock`}
                    </p>
                  </div>
                  <label htmlFor={`qty-${p.id}`} className="sr-only">
                    Quantity of {p.name}
                  </label>
                  <input
                    id={`qty-${p.id}`}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={max}
                    disabled={out}
                    value={qty[p.id] ?? 0}
                    onChange={(e) => setQty((s) => ({ ...s, [p.id]: Math.min(max, Math.max(0, Math.floor(Number(e.target.value) || 0))) }))}
                    data-testid={`order-qty-${p.id}`}
                    className={`w-16 rounded-lg border border-slate-700 bg-[#0B0F17] px-2 py-1.5 text-sm text-slate-100 disabled:opacity-50 ${focusRing}`}
                  />
                </li>
              );
            })}
          </ul>
          <p className="mt-3 flex justify-between text-sm text-slate-200" data-testid="order-subtotal">
            <span>Items subtotal</span>
            <span className="tabular-nums">{formatUsd(subtotal)}</span>
          </p>
          <p className="mt-1 text-xs text-slate-400">Shipping and the final total are calculated from the shop settings when you send the card.</p>
          {error && (
            <p role="alert" data-testid="order-error" className="mt-2 rounded-lg bg-red-500/10 p-2 text-xs text-red-200 ring-1 ring-red-400/30">
              {error}
            </p>
          )}
          <button type="button" onClick={send} disabled={lines.length === 0 || sending} data-testid="order-send-btn" className={`mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-indigo-500 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-45 ${focusRing}`}>
            {sending ? <PackagePlus className="h-4 w-4" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
            {sending ? "Sending" : "Send order card"}
          </button>
        </>
      )}
    </div>
  );
}
