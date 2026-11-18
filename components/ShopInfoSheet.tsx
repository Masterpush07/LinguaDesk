"use client";

import type { ShopData } from "@/lib/shop-data";

type Props = {
  shop: ShopData;
  onClose: () => void;
  onAsk: (question: string) => void;
};

// Questions a stranger can tap, built from the shop's own data so they always match what the AI knows.
function starterQuestions(shop: ShopData): string[] {
  const [first, second] = shop.products;
  return [
    first && `How much is the ${first.name.toLowerCase()}?`,
    second && `What colours does the ${second.name.toLowerCase()} come in?`,
    "Do you ship to the US, and how long does it take?",
    "What is your return policy?",
    shop.policies.giftWrap && "Do you offer gift wrapping?",
    shop.policies.customOrders && "Can I order a custom colour?",
  ].filter((q): q is string => !!q);
}

// Full-panel overlay in the customer chat: tells visitors what this shop sells and what they can ask, so nobody has to guess.
export default function ShopInfoSheet({ shop, onClose, onAsk }: Props) {
  const s = shop.shipping;
  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-surface text-ink" role="dialog" aria-label={`About ${shop.name}`}>
      <div className="flex items-center gap-2 border-b border-line-soft px-4 py-3">
        <h2 className="flex-1 truncate text-[15px] font-semibold">About {shop.name}</h2>
        <button
          onClick={onClose}
          className="rounded-full px-3 py-1.5 text-sm font-medium text-ink-2 hover:bg-surface-3 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
        >
          Close
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto bg-surface-2 px-4 py-4">
        <p className="text-sm text-ink-2">{shop.tagline}</p>

        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-3">Try asking</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {starterQuestions(shop).map((q) => (
              <button
                key={q}
                onClick={() => onAsk(q)}
                className="rounded-full bg-surface px-3 py-1.5 text-left text-sm text-ink ring-1 ring-line transition hover:bg-brand-soft hover:ring-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
              >
                {q}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-ink-3">You can write in any language. We reply in yours.</p>
        </section>

        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-3">What we sell</h3>
          <ul className="mt-2 space-y-2">
            {shop.products.map((p) => (
              <li key={p.id} className="rounded-xl bg-surface p-3 ring-1 ring-line">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-medium">{p.name}</span>
                  <span className="tabular-nums font-semibold">${p.price}</span>
                </div>
                {p.description && <p className="mt-1 text-xs text-ink-2">{p.description}</p>}
                <p className="mt-1 text-xs text-ink-3">
                  {[p.colors.length > 0 && p.colors.join(", "), p.inStock ? "In stock" : "Out of stock"].filter(Boolean).join(" · ")}
                </p>
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-1 text-sm text-ink-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-3">Good to know</h3>
          <p>
            <span className="font-medium text-ink">Shipping:</span>{" "}
            {s.fee === 0 ? "free on all orders" : s.freeAbove > 0 ? `free above $${s.freeAbove}, otherwise $${s.fee}` : `$${s.fee}`}
            {s.worldwideDays && `. ${s.worldwideDays} worldwide`}.
          </p>
          {shop.policies.returns && (
            <p>
              <span className="font-medium text-ink">Returns:</span> {shop.policies.returns}
            </p>
          )}
          {shop.policies.payment && (
            <p>
              <span className="font-medium text-ink">Payment:</span> {shop.policies.payment}
            </p>
          )}
          {shop.hours && (
            <p>
              <span className="font-medium text-ink">Team hours:</span> {shop.hours}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
