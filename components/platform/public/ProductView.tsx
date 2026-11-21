"use client";

import Link from "next/link";
import { Clock, MapPin } from "lucide-react";
import { NextAction, PageFallback, ProductImage } from "@/components/platform/ui";
import { CurrencyNote, Price } from "@/components/platform/Prefs";
import ProductPurchasePanel from "@/components/platform/orders/ProductPurchasePanel";
import { ErrorPanel, LanguageChips, TeamStatus } from "@/components/platform/public/parts";
import { NotFoundPanel } from "@/components/platform/public/StorefrontView";
import type { ProductDetail } from "@/components/platform/public/types";
import { useApi } from "@/components/platform/public/useApi";

export default function ProductView({ sellerSlug, productId }: { sellerSlug: string; productId: string }) {
  const { data, error, retry } = useApi<ProductDetail>(`/api/public/products/${encodeURIComponent(productId)}`);

  if (error?.status === 404 || (data && data.seller.slug !== sellerSlug)) {
    return <NotFoundPanel testId="product-not-found" title="This product could not be found" text="It may have been removed or is no longer for sale. Browse the shop or the marketplace to see what is available." />;
  }
  if (error && !data) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <ErrorPanel message={error.message} onRetry={retry} testId="product-error" />
      </div>
    );
  }
  if (!data) return <PageFallback label="Loading product" />;

  const { seller } = data;
  const chatBase = `/chat/${seller.slug}`;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <nav aria-label="Breadcrumb" className="mb-6 text-sm text-slate-500" data-testid="product-breadcrumb">
        <Link href="/marketplace" data-testid="product-breadcrumb-marketplace" className="hover:text-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
          Marketplace
        </Link>
        <span aria-hidden="true"> / </span>
        <Link href={`/s/${seller.slug}`} data-testid="product-breadcrumb-shop" className="hover:text-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
          {seller.name}
        </Link>
        <span aria-hidden="true"> / </span>
        <span className="text-slate-900" aria-current="page">
          {data.name}
        </span>
      </nav>

      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <ProductImage product={{ name: data.name, image: data.imageUrl ?? undefined }} className="aspect-[4/3] w-full rounded-2xl border border-slate-200" />
        </div>

        <div className="space-y-6 lg:col-span-5">
          <div>
            {data.category && (
              <p className="text-sm font-medium text-cyan-700" data-testid="product-category">
                {data.category}
              </p>
            )}
            <h1 className="mt-1 font-heading text-3xl font-semibold tracking-tight text-slate-900" data-testid="product-name">
              {data.name}
            </h1>
            <Price usd={data.priceUsd} className="mt-3 block font-heading text-3xl font-semibold text-slate-900" />
            <CurrencyNote className="mt-1" testId="product-currency-note" />
            {data.description && (
              <p className="mt-4 leading-relaxed text-slate-600" data-testid="product-description">
                {data.description}
              </p>
            )}
          </div>

          <section aria-label="Choose options" className="rounded-2xl border border-slate-200 bg-white p-5">
            <ProductPurchasePanel key={data.id} productId={data.id} name={data.name} seller={seller.slug} colors={data.colors} sizes={data.sizes} stock={data.stock} priceUsd={data.priceUsd} />
          </section>

          <section aria-label="Sold by" data-testid="product-seller-card" className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-start gap-3">
              <span
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-100 to-cyan-100 font-heading text-lg font-semibold text-indigo-700"
                aria-hidden="true"
              >
                {seller.name.slice(0, 1).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-slate-500">Sold by</p>
                <Link
                  href={`/s/${seller.slug}`}
                  data-testid="product-seller-link"
                  className="font-heading text-base font-semibold text-slate-900 hover:text-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                >
                  {seller.name}
                </Link>
                {seller.country && (
                  <p className="mt-0.5 flex items-center gap-1 text-sm text-slate-500">
                    <MapPin className="h-3.5 w-3.5" aria-hidden="true" /> {seller.country}
                  </p>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
                  <TeamStatus online={seller.teamOnline} testId="product-seller-status" />
                  {seller.hours && (
                    <span className="inline-flex items-center gap-1" data-testid="product-seller-hours">
                      <Clock className="h-3.5 w-3.5" aria-hidden="true" /> {seller.hours}
                    </span>
                  )}
                </div>
                <div className="mt-2">
                  <LanguageChips codes={seller.languages} />
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>

      <div className="mt-10">
        <NextAction
          title="Questions about sizing, shipping or custom work?"
          text="Ask in your own language. The AI assistant responds instantly and an agent can join at any time."
          href={`${chatBase}?product=${data.id}`}
          cta="Ask about this product"
        />
      </div>
    </div>
  );
}
