import Link from "next/link";
import { Sparkles, Star } from "lucide-react";
import { LANGS, initials } from "@/lib/platform/data";
import type { ConvStatus, LangCode, Priority, Product, Seller } from "@/lib/platform/types";
import { Price } from "@/components/platform/Prefs";

// Small presentational pieces shared by the customer, agent and seller screens. No hooks, so they work in server and client components.

export function PrototypeBadge({ dark = false }: { dark?: boolean }) {
  return (
    <span
      data-testid="prototype-badge"
      title="This screen displays sample data. No backend is connected."
      className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide ${dark ? "bg-amber-400/10 text-amber-300 ring-1 ring-amber-400/30" : "bg-amber-50 text-amber-700 ring-1 ring-amber-200"}`}
    >
      Prototype · sample data
    </span>
  );
}

export function LangBadge({ code, dark = false, className = "" }: { code: LangCode; dark?: boolean; className?: string }) {
  const l = LANGS[code];
  return (
    <span
      data-testid={`lang-badge-${code}`}
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide ${dark ? "bg-slate-800 text-slate-300" : "bg-slate-100 text-slate-600"} ${className}`}
    >
      <span aria-hidden="true">{l.flag}</span>
      {l.code}
    </span>
  );
}

export function AiBadge({ dark = false, label = "AI assistant" }: { dark?: boolean; label?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${dark ? "bg-violet-500/15 text-violet-300 ring-1 ring-violet-400/30" : "bg-violet-50 text-violet-700 ring-1 ring-violet-200"}`}
    >
      <Sparkles className="h-2.5 w-2.5" aria-hidden="true" />
      {label}
    </span>
  );
}

const STATUS: Record<ConvStatus, { label: string; light: string; dark: string; hint: string }> = {
  ai: {   label: "Assistant answering", light: "bg-violet-50 text-violet-700 ring-violet-200", dark: "bg-violet-500/15 text-violet-300 ring-violet-400/30", hint: "The AI assistant is handling this conversation." },
    waiting: { label: "Needs a reply", light: "bg-amber-50 text-amber-700 ring-amber-200", dark: "bg-amber-400/10 text-amber-300 ring-amber-400/30", hint: "The shop owner has been notified and a reply is needed." },
    assigned: { label: "With the shop team", light: "bg-emerald-50 text-emerald-700 ring-emerald-200", dark: "bg-emerald-400/10 text-emerald-300 ring-emerald-400/30", hint: "The shop team is handling this conversation." },
    resolved: { label: "Resolved", light: "bg-slate-100 text-slate-600 ring-slate-200", dark: "bg-slate-700/40 text-slate-300 ring-slate-600", hint: "This conversation is closed." },
};

export function statusHint(status: ConvStatus) {
  return STATUS[status].hint;
}

export function StatusBadge({ status, dark = false }: { status: ConvStatus; dark?: boolean }) {
  const s = STATUS[status];
  return (
    <span
      data-testid={`status-${status}`}
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${dark ? s.dark : s.light}`}
    >
      {s.label}
    </span>
  );
}

const PRIORITY: Record<Priority, { label: string; cls: string }> = {
  urgent: { label: "Critical", cls: "bg-red-500/15 text-red-300 ring-red-400/30" },
  high: { label: "High", cls: "bg-amber-400/10 text-amber-300 ring-amber-400/30" },
  normal: { label: "Normal", cls: "bg-slate-700/40 text-slate-300 ring-slate-600" },
};

export function PriorityTag({ priority }: { priority: Priority }) {
  const p = PRIORITY[priority];
  return (
    <span data-testid={`priority-${priority}`} className={`rounded-md px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide ring-1 ${p.cls}`}>
      {p.label}
    </span>
  );
}

export function Avatar({ name, src, size = "h-9 w-9", dark = false }: { name: string; src?: string; size?: string; dark?: boolean }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={name} className={`${size} shrink-0 rounded-full object-cover ring-1 ${dark ? "ring-slate-700" : "ring-slate-200"}`} />;
  }
  return (
    <span
      aria-hidden="true"
      className={`${size} flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-xs font-semibold text-white`}
    >
      {initials(name)}
    </span>
  );
}

// Shows the photo when there is one; otherwise (or if it fails to load) a neutral gradient tile keeps the layout stable.
export function ProductImage({ product, className = "" }: { product: Pick<Product, "name" | "image">; className?: string }) {
  return (
    <div className={`relative overflow-hidden bg-gradient-to-br from-indigo-100 via-violet-100 to-cyan-100 ${className}`}>
      <span className="absolute inset-0 flex items-center justify-center px-4 text-center text-sm font-medium text-indigo-400">{product.name}</span>
      {product.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={product.image} alt={product.name} loading="lazy" referrerPolicy="no-referrer" className="absolute inset-0 h-full w-full object-cover" />
      )}
    </div>
  );
}

export function Rating({ value, count }: { value: number | null; count?: number }) {
  if (value === null || count === 0) {
    return (
      <span className="text-xs text-slate-500" data-testid="rating-none">
        No reviews yet
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs text-slate-600" data-testid="rating-value">
      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-hidden="true" />
      <span className="font-medium text-slate-800">{value.toFixed(1)}</span>
      {count !== undefined && <span className="text-slate-400">({count})</span>}
    </span>
  );
}

export function ProductCard({ product, sellerName }: { product: Product; sellerName?: string }) {
  const out = product.stock === 0;
  return (
    <Link
      href={`/s/${product.seller}/p/${product.id}`}
      data-testid={`product-card-${product.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
    >
      <ProductImage product={product} className="aspect-[4/3] w-full" />
      <div className="flex flex-1 flex-col gap-1.5 p-4">
        {sellerName && <p className="text-xs font-medium text-slate-500">{sellerName}</p>}
        <h3 className="font-heading text-[15px] font-semibold leading-snug text-slate-900 group-hover:text-indigo-700">{product.name}</h3>
        <div className="mt-auto flex items-center justify-between pt-2">
          <Price usd={product.priceUsd} className="font-heading text-lg font-semibold text-slate-900" />
          {out ? (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">Out of stock</span>
          ) : (
            <Rating value={product.rating} count={product.reviews} />
          )}
        </div>
      </div>
    </Link>
  );
}

export function SellerCard({ seller }: { seller: Seller }) {
  return (
    <Link
      href={`/s/${seller.slug}`}
      data-testid={`seller-card-${seller.slug}`}
      className="group flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-100 to-cyan-100 text-xl" aria-hidden="true">
          {seller.flag}
        </div>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${seller.online ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${seller.online ? "bg-emerald-500" : "bg-slate-400"}`} />
          {seller.online ? "Online" : "Away"}
        </span>
      </div>
      <div>
        <h3 className="font-heading text-base font-semibold text-slate-900 group-hover:text-indigo-700">{seller.name}</h3>
        <p className="mt-0.5 text-sm text-slate-500">{seller.tagline}</p>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {seller.languages.map((c) => (
          <LangBadge key={c} code={c} />
        ))}
      </div>
      <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
        <Rating value={seller.rating} count={seller.reviews} />
        <span>{seller.responseTime}</span>
      </div>
    </Link>
  );
}

export function PageFallback({ label }: { label: string }) {
  return (
    <div role="status" aria-busy="true" data-testid="page-loading" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <span className="sr-only">{label}</span>
      <div className="h-8 w-1/3 animate-pulse rounded-lg bg-slate-200 motion-reduce:animate-none" />
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-40 animate-pulse rounded-2xl bg-slate-100 motion-reduce:animate-none" />
        ))}
      </div>
    </div>
  );
}

export function PageHeading({ title, subtitle, children }: { title: string; subtitle?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-sm text-slate-500 sm:text-base">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

// Always tells the user what they can do next, so no screen is a dead end.
export function NextAction({ title, text, href, cta, dark = false }: { title: string; text: string; href: string; cta: string; dark?: boolean }) {
  return (
    <div
      data-testid="next-action"
      className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4 ${dark ? "border border-slate-800 bg-slate-900" : "border border-indigo-100 bg-indigo-50/60"}`}
    >
      <div>
        <p className={`text-sm font-semibold ${dark ? "text-white" : "text-slate-900"}`}>{title}</p>
        <p className={`text-sm ${dark ? "text-slate-400" : "text-slate-600"}`}>{text}</p>
      </div>
      <Link
        href={href}
        className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
      >
        {cta}
      </Link>
    </div>
  );
}

export function EmptyState({ title, text, href, cta }: { title: string; text: string; href?: string; cta?: string }) {
  return (
    <div data-testid="empty-state" className="flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
      <p className="font-heading text-lg font-semibold text-slate-900">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-slate-500">{text}</p>
      {href && cta && (
        <Link href={href} className="mt-4 rounded-full bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
          {cta}
        </Link>
      )}
    </div>
  );
}
