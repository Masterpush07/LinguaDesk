"use client";

import { useState } from "react";
import { priceOrder, type OrderLine } from "@/lib/catalog";
import type { ShopOrderInfo } from "@/lib/shop-data";

type Props = {
  shop: ShopOrderInfo;
  onSend: (lines: OrderLine[]) => Promise<void>;
  onClose: () => void;
};

// Owner picks products and quantities; the total is computed from the shop's own settings, so it always matches what the server charges.
export default function OrderBuilder({ shop, onSend, onClose }: Props) {
  const [qty, setQty] = useState<Record<string, number>>({});
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const lines: OrderLine[] = shop.products.flatMap((p) => ((qty[p.id] ?? 0) > 0 && p.inStock ? [{ id: p.id, qty: qty[p.id] }] : []));
  const priced = priceOrder(lines, shop);
  const { freeAbove } = shop.shipping;

  const change = (id: string, delta: number) =>
    setQty((prev) => ({ ...prev, [id]: Math.min(20, Math.max(0, (prev[id] ?? 0) + delta)) }));

  async function send() {
    if (!priced || sending) return;
    setSending(true);
    setError("");
    try {
      await onSend(lines);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the order.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mb-2 max-h-72 overflow-y-auto rounded-2xl bg-surface-2 p-3 ring-1 ring-line">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-semibold">Create an order</p>
        <button type="button" onClick={onClose} aria-label="Close order builder" className="rounded-full px-2 py-1 text-xs text-ink-2 hover:bg-surface-3">
          Close
        </button>
      </div>

      <ul className="space-y-1.5">
        {shop.products.map((p) => (
          <li key={p.id} className="flex items-center justify-between gap-3 text-sm">
            <span className={p.inStock ? "" : "text-ink-3"}>
              {p.name} <span className="text-ink-3">${p.price}</span>
              {!p.inStock && <span className="ml-1 text-xs">(out of stock)</span>}
            </span>
            <span className="flex items-center gap-2">
              <button type="button" onClick={() => change(p.id, -1)} disabled={!qty[p.id]} aria-label={`Fewer ${p.name}`} className="h-7 w-7 rounded-full bg-surface text-ink ring-1 ring-line hover:bg-surface-3 disabled:opacity-40">
                &minus;
              </button>
              <span className="w-5 text-center tabular-nums" aria-live="polite">
                {qty[p.id] ?? 0}
              </span>
              <button type="button" onClick={() => change(p.id, 1)} disabled={!p.inStock} aria-label={`More ${p.name}`} className="h-7 w-7 rounded-full bg-surface text-ink ring-1 ring-line hover:bg-surface-3 disabled:opacity-40">
                +
              </button>
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-2 text-sm">
        {priced ? (
          <span className="text-ink-2">
            Shipping {priced.shipping === 0 ? "free" : `$${priced.shipping}`}
            {freeAbove > 0 && <span className="text-ink-3"> (free above ${freeAbove})</span>}
            <span className="ml-3 font-semibold text-ink">Total ${priced.total}</span>
          </span>
        ) : (
          <span className="text-ink-3">Choose at least one item.</span>
        )}
        <button
          type="button"
          onClick={() => void send()}
          disabled={!priced || sending}
          className="shrink-0 rounded-full bg-brand px-4 py-1.5 text-xs font-medium text-white hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 disabled:bg-surface-3 disabled:text-ink-3"
        >
          {sending ? "Sending..." : "Send order card"}
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-2 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger-ink">
          {error}
        </p>
      )}
    </div>
  );
}
