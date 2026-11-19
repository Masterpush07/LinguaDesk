"use client";

import Link from "next/link";
import { Clock, MapPin, MessageCircle, RotateCcw, Store, Truck } from "lucide-react";
import { NextAction, PageFallback } from "@/components/platform/ui";
import { ErrorPanel, FOCUS, LanguageChips, PublicProductCard, TeamStatus } from "@/components/platform/public/parts";
import { ShippingSummary } from "@/components/platform/public/ShippingSummary";
import type { ListedProduct, ShopDetail } from "@/components/platform/public/types";
import { useApi } from "@/components/platform/public/useApi";

const MORE_POLICIES = [
  ["payment", "Payment"],
  ["customOrders", "Custom orders"],
  ["discounts", "Discounts"],
  ["giftWrap", "Gift wrapping"],
  ["care", "Care instructions"],
] as const;

export function NotFoundPanel({ title, text, testId }: { title: string; text: string; testId: string }) {
  return (
    <div className="mx-auto max-w-xl px-4 py-20 text-center" data-testid={testId}>
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
        <Store className="h-6 w-6" aria-hidden="true" />
      </span>
      <h1 className="mt-4 font-heading text-2xl font-semibold text-slate-900">{title}</h1>
      <p className="mt-2 text-sm text-slate-500">{text}</p>
      <Link
        href="/marketplace"
        data-testid={`${testId}-back`}
        className={`mt-6 inline-flex rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 motion-reduce:transition-none ${FOCUS}`}
      >
        Back to the marketplace
      </Link>
    </div>
  );
}

export default function StorefrontView({ slug }: { slug: string }) {
  const { data, error, retry } = useApi<ShopDetail>(`/api/public/sellers/${encodeURIComponent(slug)}`);

  if (error?.status === 404) {
    return <NotFoundPanel testId="storefront-not-found" title="This shop could not be found" text="The link may be mistyped, or the shop may have closed. Browse the marketplace to find other shops." />;
  }
  if (error && !data) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <ErrorPanel message={error.message} onRetry={retry} testId="storefront-error" />
      </div>
    );
  }
  if (!data) return <PageFallback label="Loading shop" />;

  const { seller, products, faqs } = data;
  const listed: ListedProduct[] = products.map((p) => ({ ...p, seller: { slug: seller.slug, name: seller.name, country: seller.country } }));
  const extraPolicies = MORE_POLICIES.filter(([key]) => seller.policies[key]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-slate-500" data-testid="storefront-breadcrumb">
        <Link href="/marketplace" className="hover:text-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
          Marketplace
        </Link>
        <span aria-hidden="true"> / </span>
        <span className="text-slate-900">{seller.name}</span>
      </nav>

      <header data-testid="storefront-header" className="flex flex-col gap-5 rounded-2xl border border-slate-200 bg-white p-6 md:flex-row md:items-start md:justify-between">
        <div className="flex gap-4">
          <span
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-100 to-cyan-100 font-heading text-2xl font-semibold text-indigo-700"
            aria-hidden="true"
          >
            {seller.name.slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-heading text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl" data-testid="storefront-name">
                {seller.name}
              </h1>
              <TeamStatus online={seller.teamOnline} testId="storefront-online-status" />
            </div>
            {seller.country && (
              <p className="mt-1 flex items-center gap-1 text-sm text-slate-500" data-testid="storefront-country">
                <MapPin className="h-3.5 w-3.5" aria-hidden="true" /> {seller.country}
              </p>
            )}
            {seller.tagline && <p className="mt-2 max-w-xl text-slate-600">{seller.tagline}</p>}
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-500">
              <span data-testid="storefront-response-time">Reply target: {seller.responseTargetMin} minutes</span>
              {seller.hours && (
                <span className="inline-flex items-center gap-1" data-testid="storefront-hours">
                  <Clock className="h-3.5 w-3.5" aria-hidden="true" /> {seller.hours}
                </span>
              )}
            </div>
            <div className="mt-3">
              <LanguageChips codes={seller.languages} testId="storefront-languages" />
            </div>
          </div>
        </div>
        <Link
          href={`/chat/${seller.slug}`}
          data-testid="storefront-chat-now"
          className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-indigo-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 motion-reduce:transition-none ${FOCUS}`}
        >
          <MessageCircle className="h-4 w-4" aria-hidden="true" /> Start a conversation
        </Link>
      </header>

      <section className="mt-10" aria-labelledby="shop-products-heading">
        <h2 id="shop-products-heading" className="font-heading text-xl font-semibold text-slate-900">
          Products <span className="text-sm font-normal text-slate-400">({listed.length})</span>
        </h2>
        {listed.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500" data-testid="storefront-empty">
            This shop has not listed any products yet. Start a conversation to ask what the shop can make for you.
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" data-testid="storefront-product-grid">
            {listed.map((p) => (
              <PublicProductCard key={p.id} product={p} showSeller={false} />
            ))}
          </div>
        )}
      </section>

      <section className="mt-10 grid gap-4 md:grid-cols-3" aria-label="About and policies">
        <article data-testid="storefront-about" className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="font-heading text-base font-semibold text-slate-900">About the shop</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">{seller.about || "The shop has not added a description yet."}</p>
        </article>
        <article data-testid="storefront-shipping" className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="flex items-center gap-2 font-heading text-base font-semibold text-slate-900">
            <Truck className="h-4 w-4 text-cyan-600" aria-hidden="true" /> Shipping
          </h2>
          <ShippingSummary shipping={seller.shipping} testId="storefront-shipping-details" />
        </article>
        <article data-testid="storefront-returns" className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="flex items-center gap-2 font-heading text-base font-semibold text-slate-900">
            <RotateCcw className="h-4 w-4 text-cyan-600" aria-hidden="true" /> Returns
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">{seller.policies.returns || "The shop has not published a returns policy yet. Start a conversation to ask."}</p>
        </article>
      </section>

      {extraPolicies.length > 0 && (
        <section className="mt-4 grid gap-4 md:grid-cols-2" aria-label="More policies" data-testid="storefront-policies">
          {extraPolicies.map(([key, label]) => (
            <article key={key} data-testid={`storefront-policy-${key}`} className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="font-heading text-base font-semibold text-slate-900">{label}</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{seller.policies[key]}</p>
            </article>
          ))}
        </section>
      )}

      {faqs.length > 0 && (
        <section className="mt-10" aria-labelledby="shop-faq-heading" data-testid="storefront-faqs">
          <h2 id="shop-faq-heading" className="font-heading text-xl font-semibold text-slate-900">
            Frequently asked questions
          </h2>
          <dl className="mt-4 divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
            {faqs.map((f, i) => (
              <div key={`${i}-${f.q}`} className="p-5" data-testid={`storefront-faq-${i}`}>
                <dt className="text-sm font-semibold text-slate-900">{f.q}</dt>
                <dd className="mt-1 text-sm leading-relaxed text-slate-600">{f.a}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      <div className="mt-8">
        <NextAction
          title="Need help choosing?"
          text="Ask the shop in your own language. The AI assistant responds instantly and an agent can join at any time."
          href={`/chat/${seller.slug}`}
          cta="Start a conversation"
        />
      </div>
    </div>
  );
}
