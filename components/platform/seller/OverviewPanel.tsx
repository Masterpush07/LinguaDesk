"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertTriangle, BookOpenCheck, Languages, MessageSquare, Plus, ShieldCheck, Sparkles, UserPlus } from "lucide-react";
import { Card, ErrorBlock, FOCUS, LoadingBlock } from "@/components/platform/seller/ui";
import { NextAction, PageHeading, StatusBadge } from "@/components/platform/ui";
import { useStaff } from "@/lib/v2/client";
import type { LearnResponse } from "@/lib/v2/learn-types";
import { browserTimeZone, useApi } from "@/lib/v2/seller-hooks";
import { formatDateTime, PRIORITY_LABEL, type OverviewDto } from "@/lib/v2/seller-types";

const ACTIONS = [
  { href: "/seller/inventory", label: "Add product", icon: Plus, testId: "quick-add-product" },
  { href: "/seller/glossary", label: "Edit glossary", icon: Languages, testId: "quick-edit-glossary" },
  { href: "/seller/team", label: "Add a teammate", icon: UserPlus, testId: "quick-invite-agent" },
];

const PRIORITY_STYLE = {
  normal: "bg-slate-100 text-slate-600 ring-slate-200",
  high: "bg-amber-50 text-amber-700 ring-amber-200",
  critical: "bg-red-50 text-red-700 ring-red-200",
} as const;

export default function OverviewPanel() {
  const staff = useStaff({ owner: true });
  const [tz] = useState(browserTimeZone);
  const { data, error, loading, reload } = useApi<OverviewDto>(`/api/desk/overview?tz=${encodeURIComponent(tz)}`);
  const learn = useApi<LearnResponse>("/api/desk/learn");

  const kpis = data
    ? [
        { id: "open-chats", label: "Open conversations", value: String(data.openThreads), hint: "Conversations that are not yet resolved." },
        { id: "awaiting-reply", label: "Needs your reply", value: String(data.waitingForAgent), hint: "Customers waiting for a reply from you or your team." },
        { id: "orders-today", label: "Orders today", value: String(data.ordersToday), hint: "Orders proposed since midnight in your time zone." },
        { id: "confirmed-orders", label: "Confirmed orders", value: String(data.confirmedOrders), hint: `${data.ordersToFulfil} to pack or ship.` },
        {
          id: "ai-resolved",
          label: "Handled by AI",
          value: data.aiResolvedPercent === null ? "No data yet" : `${data.aiResolvedPercent}%`,
          hint: "Conversations the assistant answered on its own.",
        },
      ]
    : [];

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeading title={staff ? `Welcome back, ${staff.name}` : "Welcome back"} subtitle="Live activity for your shop, read from your conversations, orders and inventory." />

      {error && <ErrorBlock message={error} onRetry={reload} testId="overview-error" />}
      {loading && <LoadingBlock label="Loading shop activity" testId="overview-loading" rows={4} />}

      {data && (
        <>
          <ul className="grid grid-cols-2 gap-4 lg:grid-cols-5" data-testid="kpi-list">
            {kpis.map((k) => (
              <li key={k.id} data-testid={`kpi-${k.id}`} className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-medium text-slate-500">{k.label}</p>
                <p
                  className={`mt-1 font-heading font-semibold ${k.value === "No data yet" ? "text-lg leading-9 text-slate-500" : "text-3xl text-slate-900"}`}
                  data-testid={`kpi-${k.id}-value`}
                >
                  {k.value}
                </p>
                <p className="mt-1 text-xs text-slate-500">{k.hint}</p>
              </li>
            ))}
          </ul>

          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2" testId="recent-conversations">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-heading text-lg font-semibold text-slate-900">Recent conversations</h2>
                <MessageSquare className="h-4 w-4 text-slate-400" aria-hidden="true" />
              </div>
              {data.recentThreads.length === 0 ? (
                <p data-testid="recent-empty" className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                  No conversations yet. When a customer writes to your shop, the conversation appears here.
                </p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {data.recentThreads.map((t) => (
                    <li key={t.id} data-testid={`recent-chat-${t.id}`}>
                      <Link href="/agent" className={`flex flex-wrap items-center gap-3 rounded-lg py-3 hover:bg-slate-50 ${FOCUS}`} data-testid={`recent-chat-link-${t.id}`}>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-900">
                            {t.buyerLabel}
                            {t.subject && <span className="font-normal text-slate-500"> · {t.subject}</span>}
                          </p>
                          <p className="truncate text-xs text-slate-500">Last message {formatDateTime(t.lastAt)}</p>
                        </div>
                        <span data-testid={`recent-priority-${t.id}`} className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold ring-1 ${PRIORITY_STYLE[t.priority]}`}>
                          {PRIORITY_LABEL[t.priority]}
                        </span>
                        <StatusBadge status={t.status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              <Link href="/agent" data-testid="open-inbox-link" className={`mt-3 inline-block rounded-full text-sm font-medium text-indigo-600 hover:text-indigo-700 ${FOCUS}`}>
                Open the inbox
              </Link>
            </Card>

            <div className="flex flex-col gap-6">
              {learn.data && learn.data.total > 0 && (
                <Card testId="learn-card">
                  <div className="mb-2 flex items-center gap-2">
                    <BookOpenCheck className="h-4 w-4 text-indigo-600" aria-hidden="true" />
                    <h2 className="font-heading text-lg font-semibold text-slate-900">Questions to teach the assistant</h2>
                  </div>
                  <p className="text-sm text-slate-600">
                    <span className="font-heading text-2xl font-semibold text-slate-900" data-testid="learn-card-count">{learn.data.total}</span>{" "}
                    {learn.data.total === 1 ? "customer question was" : "customer questions were"} not answered by the assistant.
                  </p>
                  <Link href="/seller/knowledge" data-testid="learn-card-link" className={`mt-3 inline-block rounded-full text-sm font-medium text-indigo-600 hover:text-indigo-700 ${FOCUS}`}>
                    Review and teach
                  </Link>
                </Card>
              )}
              <Card testId="low-stock-card">
                <div className="mb-3 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" aria-hidden="true" />
                  <h2 className="font-heading text-lg font-semibold text-slate-900">Low stock</h2>
                </div>
                {data.lowStock.length === 0 ? (
                  <p data-testid="low-stock-empty" className="text-sm text-slate-500">No active product has 5 or fewer units left.</p>
                ) : (
                  <ul className="space-y-2">
                    {data.lowStock.map((p) => (
                      <li key={p.id} data-testid={`low-stock-${p.id}`} className="flex items-center justify-between gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm">
                        <span className="min-w-0 truncate text-slate-800">{p.name}</span>
                        <span className="shrink-0 font-semibold text-amber-700">{p.stock === 0 ? "Out of stock" : `${p.stock} left`}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <Link href="/seller/inventory" data-testid="low-stock-restock" className={`mt-3 inline-block rounded-full text-sm font-medium text-indigo-600 hover:text-indigo-700 ${FOCUS}`}>
                  Update stock
                </Link>
              </Card>

              <Card testId="quick-actions">
                <h2 className="mb-3 font-heading text-lg font-semibold text-slate-900">Quick actions</h2>
                <div className="flex flex-col gap-2">
                  {ACTIONS.map(({ href, label, icon: Icon, testId }) => (
                    <Link
                      key={href}
                      href={href}
                      data-testid={testId}
                      className={`flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-700 transition motion-reduce:transition-none hover:border-indigo-300 hover:bg-indigo-50 ${FOCUS}`}
                    >
                      <Icon className="h-4 w-4 text-indigo-600" aria-hidden="true" />
                      {label}
                    </Link>
                  ))}
                </div>
              </Card>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {[
              { icon: ShieldCheck, text: "Prices, dates and quantities in every AI reply are checked by code before a customer sees them." },
              { icon: Sparkles, text: "The AI answers only from your products, policies, knowledge base and glossary." },
            ].map(({ icon: Icon, text }) => (
              <p key={text} className="flex items-start gap-2 rounded-xl bg-white/60 p-3 text-xs text-slate-600 ring-1 ring-slate-200">
                <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo-500" aria-hidden="true" />
                {text}
              </p>
            ))}
          </div>

          <div className="mt-6">
            <NextAction title="Recommended next step" text="Add frequently asked questions so the AI can answer shipping and returns questions on your behalf." href="/seller/knowledge" cta="Open knowledge base" />
          </div>
        </>
      )}
    </div>
  );
}
