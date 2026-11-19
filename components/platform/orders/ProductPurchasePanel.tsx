"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertCircle, CheckCircle2, MessageCircle, Minus, Plus, ShoppingBag } from "lucide-react";
import { Price } from "@/components/platform/Prefs";

const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2";

export default function ProductPurchasePanel({
  productId,
  seller,
  colors,
  sizes = [],
  stock,
  priceUsd,
}: {
  productId: string;
  seller: string;
  colors: string[];
  sizes?: string[];
  stock: number;
  priceUsd: number;
}) {
  const [color, setColor] = useState(colors[0] ?? "");
  const [size, setSize] = useState(sizes[0] ?? "");
  const [qty, setQty] = useState(1);
  const out = stock === 0;
  const low = stock > 0 && stock <= 5;
  const chatHref = `/chat/${seller}?product=${productId}`;

  return (
    <div className="space-y-6" data-testid="product-purchase-panel">
      {sizes.length > 0 && (
        <div>
          <p id="size-label" className="text-sm font-medium text-slate-900">
            Size: <span className="font-normal text-slate-500" data-testid="product-selected-size">{size}</span>
          </p>
          <div role="radiogroup" aria-labelledby="size-label" className="mt-2 flex flex-wrap gap-2" data-testid="product-size-chips">
            {sizes.map((s) => {
              const active = s === size;
              return (
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setSize(s)}
                  data-testid={`product-size-${s.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                  className={`rounded-full border px-4 py-1.5 text-sm font-medium transition motion-reduce:transition-none ${FOCUS} ${
                    active ? "border-indigo-600 bg-indigo-50 text-indigo-700" : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                  }`}
                >
                  {s}
                </button>
              );
            })}
          </div>
        </div>
      )}
      {colors.length > 0 && (
        <div>
          <p id="colour-label" className="text-sm font-medium text-slate-900">
            Colour: <span className="font-normal text-slate-500" data-testid="product-selected-colour">{color}</span>
          </p>
          <div role="radiogroup" aria-labelledby="colour-label" className="mt-2 flex flex-wrap gap-2" data-testid="product-colour-chips">
            {colors.map((c) => {
              const active = c === color;
              return (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setColor(c)}
                  data-testid={`product-colour-${c.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                  className={`rounded-full border px-4 py-1.5 text-sm font-medium transition motion-reduce:transition-none ${FOCUS} ${
                    active ? "border-indigo-600 bg-indigo-50 text-indigo-700" : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                  }`}
                >
                  {c}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div>
          <p id="qty-label" className="text-sm font-medium text-slate-900">Quantity</p>
          <div role="group" aria-labelledby="qty-label" className="mt-2 inline-flex items-center rounded-full border border-slate-200 bg-white">
            <button
              type="button"
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              disabled={out || qty <= 1}
              aria-label="Decrease quantity"
              data-testid="product-qty-decrease"
              className={`flex h-10 w-10 items-center justify-center rounded-full text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent motion-reduce:transition-none ${FOCUS}`}
            >
              <Minus className="h-4 w-4" aria-hidden="true" />
            </button>
            <span className="w-10 text-center text-sm font-semibold text-slate-900" data-testid="product-qty-value" aria-live="polite">
              {out ? 0 : qty}
            </span>
            <button
              type="button"
              onClick={() => setQty((q) => Math.min(stock, q + 1))}
              disabled={out || qty >= stock}
              aria-label="Increase quantity"
              data-testid="product-qty-increase"
              className={`flex h-10 w-10 items-center justify-center rounded-full text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent motion-reduce:transition-none ${FOCUS}`}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
        {!out && (
          <div>
            <p className="text-sm font-medium text-slate-900">Subtotal</p>
            <Price usd={priceUsd * qty} className="mt-2 block font-heading text-xl font-semibold text-slate-900" />
          </div>
        )}
      </div>

      {out ? (
        <p data-testid="product-stock-status" className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-600">
          <AlertCircle className="h-4 w-4" aria-hidden="true" /> Out of stock
        </p>
      ) : (
        <p
          data-testid="product-stock-status"
          className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium ${low ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}
        >
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          {low ? `Only ${stock} left` : `In stock (${stock} available)`}
        </p>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        <Link
          href={chatHref}
          data-testid="product-ask-about"
          className={`inline-flex items-center justify-center gap-2 rounded-full bg-indigo-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 motion-reduce:transition-none ${FOCUS}`}
        >
          <MessageCircle className="h-4 w-4" aria-hidden="true" /> Ask about this product
        </Link>
        {!out && (
          <Link
            href={`${chatHref}&intent=order`}
            data-testid="product-order-via-chat"
            className={`inline-flex items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-800 transition hover:border-indigo-300 hover:text-indigo-700 motion-reduce:transition-none ${FOCUS}`}
          >
            <ShoppingBag className="h-4 w-4" aria-hidden="true" /> Order via conversation
          </Link>
        )}
      </div>
      {out && (
        <p data-testid="product-out-of-stock-note" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Ordering is paused because this item is sold out. You can still ask the shop when it will be back or if they can make one for you.
        </p>
      )}
    </div>
  );
}
