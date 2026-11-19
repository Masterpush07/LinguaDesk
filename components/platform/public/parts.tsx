import Link from "next/link";
import { AlertCircle, RefreshCw, MapPin } from "lucide-react";
import { ProductImage } from "@/components/platform/ui";
import { Price } from "@/components/platform/Prefs";
import { LANGS } from "@/lib/platform/data";
import type { LangCode } from "@/lib/platform/types";
import type { ListedProduct, ShopSummary } from "@/components/platform/public/types";

export const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2";

export function LanguageChips({ codes, label = "Languages this shop speaks", testId }: { codes: string[]; label?: string; testId?: string }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5" aria-label={label} data-testid={testId}>
      {codes.map((c) => {
        const lang = LANGS[c as LangCode];
        return (
          <span
            key={c}
            title={lang?.name}
            data-testid={`lang-badge-${c}`}
            className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-slate-600"
          >
            {lang && <span aria-hidden="true">{lang.flag}</span>}
            {c}
          </span>
        );
      })}
    </div>
  );
}

export function TeamStatus({ online, testId }: { online: boolean; testId: string }) {
  return (
    <span
      data-testid={testId}
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${online ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${online ? "bg-emerald-500" : "bg-slate-400"}`} aria-hidden="true" />
      {online ? "Team online" : "Team away, AI assistant responds"}
    </span>
  );
}

export function PublicProductCard({ product, showSeller = true }: { product: ListedProduct; showSeller?: boolean }) {
  const out = product.stock === 0;
  return (
    <Link
      href={`/s/${product.seller.slug}/p/${product.id}`}
      data-testid={`product-card-${product.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:-translate-y-0.5 hover:shadow-lg motion-reduce:transition-none motion-reduce:hover:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
    >
      <ProductImage product={{ name: product.name, image: product.imageUrl ?? undefined }} className="aspect-[4/3] w-full" />
      <div className="flex flex-1 flex-col gap-1.5 p-4">
        {showSeller && <p className="text-xs font-medium text-slate-500">{product.seller.name}</p>}
        <h3 className="font-heading text-[15px] font-semibold leading-snug text-slate-900 group-hover:text-indigo-700">{product.name}</h3>
        <div className="mt-auto flex items-center justify-between pt-2">
          <Price usd={product.priceUsd} className="font-heading text-lg font-semibold text-slate-900" />
          <span
            data-testid={`product-card-status-${product.id}`}
            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${out ? "bg-slate-100 text-slate-500" : "bg-emerald-50 text-emerald-700"}`}
          >
            {out ? "Out of stock" : "In stock"}
          </span>
        </div>
      </div>
    </Link>
  );
}

export function PublicSellerCard({ seller }: { seller: ShopSummary }) {
  return (
    <Link
      href={`/s/${seller.slug}`}
      data-testid={`seller-card-${seller.slug}`}
      className="group flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-lg motion-reduce:transition-none motion-reduce:hover:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-100 to-cyan-100 font-heading text-lg font-semibold text-indigo-700"
          aria-hidden="true"
        >
          {seller.name.slice(0, 1).toUpperCase()}
        </span>
        <span
          data-testid={`seller-card-status-${seller.slug}`}
          className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${seller.teamOnline ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${seller.teamOnline ? "bg-emerald-500" : "bg-slate-400"}`} aria-hidden="true" />
          {seller.teamOnline ? "Online" : "Away"}
        </span>
      </div>
      <div>
        <h3 className="font-heading text-base font-semibold text-slate-900 group-hover:text-indigo-700">{seller.name}</h3>
        {seller.tagline && <p className="mt-0.5 text-sm text-slate-500">{seller.tagline}</p>}
        {seller.country && (
          <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
            <MapPin className="h-3 w-3" aria-hidden="true" /> {seller.country}
          </p>
        )}
      </div>
      <LanguageChips codes={seller.languages} />
      <p className="mt-auto border-t border-slate-100 pt-3 text-xs text-slate-500" data-testid={`seller-card-products-${seller.slug}`}>
        {seller.productCount === 0 ? "No products listed yet" : `${seller.productCount} ${seller.productCount === 1 ? "product" : "products"}`}
      </p>
    </Link>
  );
}

export function GridSkeleton({ count, label }: { count: number; label: string }) {
  return (
    <div role="status" aria-busy="true" data-testid="grid-loading" className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
      <span className="sr-only">{label}</span>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="h-56 animate-pulse rounded-2xl bg-slate-100 motion-reduce:animate-none" />
      ))}
    </div>
  );
}

export function ErrorPanel({ message, onRetry, testId = "load-error" }: { message: string; onRetry: () => void; testId?: string }) {
  return (
    <div role="alert" data-testid={testId} className="flex flex-col items-center rounded-2xl border border-red-200 bg-red-50 px-6 py-10 text-center">
      <AlertCircle className="h-6 w-6 text-red-600" aria-hidden="true" />
      <p className="mt-2 font-heading text-base font-semibold text-red-900">Something went wrong</p>
      <p className="mt-1 max-w-sm text-sm text-red-700">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        data-testid={`${testId}-retry`}
        className={`mt-4 inline-flex items-center gap-2 rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 motion-reduce:transition-none ${FOCUS}`}
      >
        <RefreshCw className="h-4 w-4" aria-hidden="true" /> Retry
      </button>
    </div>
  );
}
