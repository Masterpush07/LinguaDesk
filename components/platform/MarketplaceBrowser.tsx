"use client";

import { useEffect, useMemo, useState } from "react";
import { Info, Search, Sparkles } from "lucide-react";
import { EmptyState } from "@/components/platform/ui";
import { ErrorPanel, GridSkeleton, PublicProductCard, PublicSellerCard } from "@/components/platform/public/parts";
import { useApi } from "@/components/platform/public/useApi";
import type { ListedProduct, SearchResult, ShopSummary } from "@/components/platform/public/types";

const PILL = "rounded-full px-3 py-1.5 text-sm font-medium transition motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500";
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-");

// Search reads a whole sentence (in any language) into filters; category and country chips narrow it further. Chips are built from the data that exists.
export default function MarketplaceBrowser() {
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [country, setCountry] = useState("");

  useEffect(() => {
    const id = setTimeout(() => setSearch(query.trim()), 250);
    return () => clearTimeout(id);
  }, [query]);

  const filtered = search !== "" || category !== "" || country !== "";
  const smart = search !== "";
  const productParams = new URLSearchParams({ q: search, category, country }).toString();
  const sellerParams = new URLSearchParams({ q: search, country }).toString();

  const allProducts = useApi<ListedProduct[]>("/api/public/products");
  const allSellers = useApi<ShopSummary[]>("/api/public/sellers");
  const smartResult = useApi<SearchResult>(smart ? `/api/public/search?${productParams}` : null);
  const someProducts = useApi<ListedProduct[]>(filtered && !smart ? `/api/public/products?${productParams}` : null);
  const someSellers = useApi<ShopSummary[]>(filtered && !smart ? `/api/public/sellers?${sellerParams}` : null);

  const productsHook = smart
    ? { data: smartResult.data?.products ?? null, loading: smartResult.loading, error: smartResult.error, retry: smartResult.retry }
    : filtered
      ? someProducts
      : allProducts;
  const sellersHook = smart
    ? { data: smartResult.data?.sellers ?? null, loading: smartResult.loading, error: smartResult.error, retry: smartResult.retry }
    : filtered
      ? someSellers
      : allSellers;
  const products = productsHook.data;
  const sellers = sellersHook.data;
  const understood = smart ? smartResult.data : null;

  const categories = useMemo(() => Array.from(new Set((allProducts.data ?? []).map((p) => p.category).filter(Boolean))).sort(), [allProducts.data]);
  const countries = useMemo(() => Array.from(new Set((allSellers.data ?? []).map((s) => s.country).filter(Boolean))).sort(), [allSellers.data]);

  const retryAll = () => {
    allProducts.retry();
    allSellers.retry();
    smartResult.retry();
    someProducts.retry();
    someSellers.retry();
  };

  if (allSellers.error && !allSellers.data) {
    return <ErrorPanel message={allSellers.error.message} onRetry={retryAll} testId="marketplace-error" />;
  }
  if (!allSellers.data) {
    return (
      <div data-testid="marketplace-loading">
        <GridSkeleton count={4} label="Loading the marketplace" />
      </div>
    );
  }
  if (allSellers.data.length === 0) {
    return (
      <EmptyState
        title="No shops have joined yet"
        text="No shops have joined yet. Be the first to open a shop."
        href="/sell"
        cta="Open a shop"
      />
    );
  }

  const busy = productsHook.loading || sellersHook.loading;

  return (
    <div>
      <div className="relative mx-auto max-w-xl">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
        <label htmlFor="market-search" className="sr-only">
          Search products and shops
        </label>
        <input
          id="market-search"
          data-testid="marketplace-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          maxLength={120}
          placeholder="Try: a red scarf under $20, in any language"
          className="w-full rounded-full border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm shadow-sm placeholder:text-slate-400 focus-visible:border-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30"
        />
      </div>

      {understood && (understood.summary.length > 0 || understood.relaxed.length > 0) && (
        <div className="mx-auto mt-3 max-w-xl text-center" data-testid="search-understood">
          {understood.summary.length > 0 && (
            <p className="flex flex-wrap items-center justify-center gap-1.5 text-xs text-slate-500">
              <Sparkles className="h-3.5 w-3.5 text-indigo-500" aria-hidden="true" />
              <span>{understood.intent.ai ? "Understood as" : "Searching for"}</span>
              {understood.summary.map((s) => (
                <span key={s} data-testid="search-chip" className="rounded-full bg-indigo-50 px-2.5 py-0.5 font-medium text-indigo-700 ring-1 ring-indigo-100">
                  {s}
                </span>
              ))}
            </p>
          )}
          {understood.relaxed.map((note) => (
            <p key={note} role="status" data-testid="search-relaxed" className="mt-2 flex items-start justify-center gap-1.5 text-xs text-amber-700">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>{note.charAt(0).toUpperCase() + note.slice(1)}.</span>
            </p>
          ))}
        </div>
      )}

      {categories.length > 0 && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2" role="group" aria-label="Filter by category">
          {["", ...categories].map((c) => (
            <button
              key={c || "all"}
              type="button"
              onClick={() => setCategory(c)}
              aria-pressed={category === c}
              data-testid={`category-${c ? slug(c) : "all"}`}
              className={`${PILL} ${category === c ? "bg-indigo-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100"}`}
            >
              {c || "All"}
            </button>
          ))}
        </div>
      )}
      {countries.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center justify-center gap-2" role="group" aria-label="Filter by country of origin">
          {["", ...countries].map((o) => (
            <button
              key={o || "all"}
              type="button"
              onClick={() => setCountry(o)}
              aria-pressed={country === o}
              data-testid={`origin-${o ? slug(o) : "all-countries"}`}
              className={`${PILL} text-xs ${country === o ? "bg-cyan-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100"}`}
            >
              {o || "All countries"}
            </button>
          ))}
        </div>
      )}

      <div className={busy ? "opacity-60 transition-opacity motion-reduce:transition-none" : ""} aria-busy={busy}>
        <section className="mt-10" aria-labelledby="products-heading">
          <h2 id="products-heading" className="font-heading text-xl font-semibold text-slate-900">
            Products {products && <span className="text-sm font-normal text-slate-400">({products.length})</span>}
          </h2>
          {productsHook.error ? (
            <div className="mt-4">
              <ErrorPanel message={productsHook.error.message} onRetry={productsHook.retry} testId="products-error" />
            </div>
          ) : !products ? (
            <GridSkeleton count={4} label="Loading products" />
          ) : products.length === 0 ? (
            <div className="mt-4">
              {filtered ? (
                <EmptyState title="No results match your search" text="Try a different search term, or clear the category and country filters." />
              ) : (
                <EmptyState title="No products are listed yet" text="The shops that have joined have not added products yet. Open a shop to list the first products." href="/sell" cta="Open a shop" />
              )}
            </div>
          ) : (
            <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" data-testid="product-grid">
              {products.map((p) => (
                <PublicProductCard key={p.id} product={p} />
              ))}
            </div>
          )}
        </section>

        <section className="mt-12" aria-labelledby="shops-heading">
          <h2 id="shops-heading" className="font-heading text-xl font-semibold text-slate-900">
            Shops {sellers && <span className="text-sm font-normal text-slate-400">({sellers.length})</span>}
          </h2>
          {sellersHook.error ? (
            <div className="mt-4">
              <ErrorPanel message={sellersHook.error.message} onRetry={sellersHook.retry} testId="shops-error" />
            </div>
          ) : !sellers ? (
            <GridSkeleton count={4} label="Loading shops" />
          ) : sellers.length === 0 ? (
            <div className="mt-4">
              <EmptyState title="No shops match your search" text="Clear the search and filters to view all shops." />
            </div>
          ) : (
            <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4" data-testid="seller-grid">
              {sellers.map((s) => (
                <PublicSellerCard key={s.slug} seller={s} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
