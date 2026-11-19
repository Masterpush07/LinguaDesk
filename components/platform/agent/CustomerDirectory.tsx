"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { MessageSquare, Search, SearchX, Users, X } from "lucide-react";
import { Empty, ErrorNotice, focusRing, Initials, LangPill, Loading, StatusPill } from "@/components/platform/agent/desk-ui";
import { formatDateTime, formatUsd, timeAgo, useDeskData, useNow } from "@/lib/v2/desk-client";
import type { DeskCustomer } from "@/lib/v2/desk-types";

export default function CustomerDirectory() {
  const now = useNow();
  const customers = useDeskData<DeskCustomer[]>("/api/desk/customers");
  const [query, setQuery] = useState("");
  const [language, setLanguage] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const all = customers.data;
  const languages = useMemo(() => Array.from(new Set((all ?? []).map((c) => c.language).filter((l): l is string => !!l))).sort(), [all]);
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (all ?? []).filter((c) => (language === "all" || c.language === language) && (!q || c.label.toLowerCase().includes(q) || (c.language ?? "").toLowerCase().includes(q)));
  }, [all, query, language]);
  const selected = (all ?? []).find((c) => c.id === selectedId) ?? null;

  useEffect(() => {
    if (!selectedId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId]);

  return (
    <div className="relative h-full overflow-hidden bg-[#0B0F17]" data-testid="customer-directory">
      <div className="h-full overflow-y-auto">
        <div className="mx-auto max-w-6xl space-y-4 p-4 sm:p-6">
          <div>
            <h1 className="font-heading text-2xl font-semibold tracking-tight text-slate-100">Customers</h1>
            <p className="mt-1 text-sm text-slate-400">Everyone who has written to your shop. Select a row to see their activity.</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-0 flex-1 sm:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
              <label htmlFor="customer-search" className="sr-only">
                Search customers by name or language
              </label>
              <input
                id="customer-search"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name or language"
                data-testid="customer-search-input"
                className={`w-full rounded-lg border border-slate-700 bg-[#111827] py-2 pl-9 pr-3 text-sm text-slate-100 placeholder:text-slate-500 ${focusRing}`}
              />
            </div>
            <label htmlFor="customer-language" className="sr-only">
              Filter by language
            </label>
            <select id="customer-language" value={language} onChange={(e) => setLanguage(e.target.value)} data-testid="customer-language-filter" className={`rounded-lg border border-slate-700 bg-[#111827] px-3 py-2 text-sm text-slate-100 ${focusRing}`}>
              <option value="all">All languages</option>
              {languages.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
            {all && (
              <span className="text-xs text-slate-400" data-testid="customer-count">
                {rows.length} of {all.length} {all.length === 1 ? "customer" : "customers"}
              </span>
            )}
          </div>

          {!all && !customers.error && <Loading label="Loading customers" testId="customers-loading" />}
          {!all && customers.error && <ErrorNotice message={customers.error} onRetry={() => void customers.reload()} testId="customers-error" />}
          {all && all.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-700">
              <Empty icon={<Users className="h-8 w-8" />} title="No customers yet" text="When a buyer messages your shop they appear here with their orders." testId="customers-empty" />
            </div>
          )}
          {all && all.length > 0 && (
            <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-[#0E1524]">
              <table className="w-full min-w-[40rem] text-left text-sm" data-testid="customer-table">
                <thead className="border-b border-slate-800 font-mono text-[11px] uppercase tracking-wide text-slate-400">
                  <tr>
                    <th scope="col" className="px-4 py-2.5 font-semibold">Customer</th>
                    <th scope="col" className="px-3 py-2.5 font-semibold">Language</th>
                    <th scope="col" className="px-3 py-2.5 text-right font-semibold">Orders</th>
                    <th scope="col" className="px-3 py-2.5 text-right font-semibold">Spend</th>
                    <th scope="col" className="px-4 py-2.5 font-semibold">Last activity</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((c) => (
                    <tr key={c.id} className={`border-b border-slate-800/70 last:border-0 ${c.id === selectedId ? "bg-slate-800" : "hover:bg-[#172033]"}`}>
                      <td className="px-4 py-2.5">
                        <button type="button" onClick={() => setSelectedId(c.id)} data-testid={`customer-row-${c.id}`} className={`flex items-center gap-2.5 rounded-md text-left ${focusRing}`}>
                          <Initials name={c.label} size="h-8 w-8" />
                          <span className="font-medium text-slate-100">{c.label}</span>
                        </button>
                      </td>
                      <td className="px-3 py-2.5">
                        <LangPill language={c.language} />
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-slate-200">{c.orders}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-slate-200">{formatUsd(c.spentUsd)}</td>
                      <td className="px-4 py-2.5 text-slate-300">{timeAgo(c.lastAt, now)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length === 0 && (
                <Empty icon={<SearchX className="h-8 w-8" />} title="No customers match" text="Nothing fits this search and language. Clear them to see everyone." testId="customers-no-match">
                  <button
                    type="button"
                    onClick={() => {
                      setQuery("");
                      setLanguage("all");
                    }}
                    data-testid="customers-clear-btn"
                    className={`mt-3 rounded-lg bg-slate-800 px-3 py-2 text-sm font-medium text-slate-100 hover:bg-slate-700 ${focusRing}`}
                  >
                    Clear search and filters
                  </button>
                </Empty>
              )}
            </div>
          )}
        </div>
      </div>

      {selected && (
        <div className="absolute inset-0 z-30 flex justify-end bg-[#0B0F17]/60" onMouseDown={() => setSelectedId(null)}>
          <aside aria-label="Customer details" data-testid="customer-drawer" onMouseDown={(e) => e.stopPropagation()} className="h-full w-full max-w-sm overflow-y-auto border-l border-slate-800 bg-[#111827] p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <Initials name={selected.label} size="h-11 w-11" />
                <div>
                  <h2 className="font-heading font-semibold tracking-tight text-slate-100" data-testid="customer-drawer-name">
                    {selected.label}
                  </h2>
                  <p className="mt-0.5">
                    <LangPill language={selected.language} />
                  </p>
                </div>
              </div>
              <button type="button" onClick={() => setSelectedId(null)} aria-label="Close customer details" data-testid="customer-drawer-close-btn" className={`rounded-md p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white ${focusRing}`}>
                <X className="h-4 w-4" />
              </button>
            </div>
            <dl className="mt-5 grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-lg bg-[#0E1524] p-3 ring-1 ring-slate-800">
                <dt className="text-[11px] text-slate-400">Orders</dt>
                <dd className="font-heading text-lg font-semibold text-slate-100" data-testid="customer-drawer-orders">
                  {selected.orders}
                </dd>
              </div>
              <div className="rounded-lg bg-[#0E1524] p-3 ring-1 ring-slate-800">
                <dt className="text-[11px] text-slate-400">Confirmed spend</dt>
                <dd className="font-heading text-lg font-semibold text-slate-100" data-testid="customer-drawer-spend">
                  {formatUsd(selected.spentUsd)}
                </dd>
              </div>
            </dl>
            <div className="mt-4 rounded-lg bg-[#0E1524] p-3 ring-1 ring-slate-800">
              <p className="text-[11px] text-slate-400">Conversation</p>
              <p className="mt-1 flex items-center gap-2 text-sm text-slate-200">
                <StatusPill status={selected.lastStatus} />
                <span>{formatDateTime(selected.lastAt)}</span>
              </p>
            </div>
            <Link href={`/agent?thread=${selected.threadId}`} data-testid="customer-open-conversation-link" className={`mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-400 ${focusRing}`}>
              <MessageSquare className="h-4 w-4" aria-hidden="true" /> Open conversation
            </Link>
          </aside>
        </div>
      )}
    </div>
  );
}
