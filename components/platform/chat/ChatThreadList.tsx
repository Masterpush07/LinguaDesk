"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Store } from "lucide-react";
import PushToggle from "@/components/platform/PushToggle";
import { EmptyState, StatusBadge, statusHint } from "@/components/platform/ui";
import { api } from "@/lib/v2/client";
import type { BuyerThreadSummary } from "@/lib/v2/buyer-types";

const SENDER_LABEL: Record<string, string> = { buyer: "You", ai: "Assistant", staff: "Shop team", system: "Shop" };

function when(iso: string): string {
  const d = new Date(iso);
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : d.toLocaleDateString([], { day: "numeric", month: "short" });
}

type State = { kind: "loading" } | { kind: "error"; message: string } | { kind: "ready"; threads: BuyerThreadSummary[] };

export default function ChatThreadList() {
  const [state, setState] = useState<State>({ kind: "loading" });

  const load = useCallback(async () => {
    try {
      setState({ kind: "ready", threads: await api<BuyerThreadSummary[]>("/api/buyer/threads") });
    } catch (err) {
      setState({ kind: "error", message: err instanceof Error ? err.message : "Your conversations could not be loaded." });
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  if (state.kind === "loading") {
    return (
      <div role="status" aria-busy="true" data-testid="chat-list-loading" className="space-y-3">
        <span className="sr-only">Loading your conversations</span>
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-100 motion-reduce:animate-none" />
        ))}
      </div>
    );
  }

  if (state.kind === "error") {
    return (
      <div role="alert" data-testid="chat-list-error" className="flex flex-col items-center rounded-2xl border border-red-200 bg-red-50 px-6 py-10 text-center">
        <p className="font-heading text-base font-semibold text-red-900">Your conversations could not be loaded</p>
        <p className="mt-1 max-w-sm text-sm text-red-800">{state.message}</p>
        <button
          type="button"
          onClick={() => {
            setState({ kind: "loading" });
            void load();
          }}
          data-testid="chat-list-retry-btn"
          className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" /> Try again
        </button>
      </div>
    );
  }

  if (state.threads.length === 0) {
    return <EmptyState title="You have no conversations yet" text="When you message a shop, the conversation appears here so you can pick it up at any time." href="/marketplace" cta="Discover shops" />;
  }

  return (
    <>
    <div data-testid="chat-list-alerts" className="mb-4 rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <PushToggle audience="buyer" compact />
    </div>
    <ul data-testid="chat-thread-list" className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
      {state.threads.map((t) => (
        <li key={t.id} data-testid={`chat-thread-${t.seller.slug}`}>
          <Link
            href={`/chat/${t.seller.slug}`}
            data-testid={`chat-thread-link-${t.seller.slug}`}
            className="flex items-start gap-3 p-4 transition hover:bg-slate-50 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-100 to-cyan-100 text-indigo-700" aria-hidden="true">
              <Store className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className={`truncate font-heading text-sm text-slate-900 ${t.unread > 0 ? "font-bold" : "font-semibold"}`}>{t.seller.name}</span>
                <span className={`shrink-0 text-xs ${t.unread > 0 ? "font-semibold text-indigo-700" : "text-slate-500"}`} data-testid={`chat-thread-time-${t.seller.slug}`}>
                  {when(t.lastAt)}
                </span>
              </div>
              <p className={`mt-0.5 flex items-center gap-2 text-sm ${t.unread > 0 ? "font-medium text-slate-900" : "text-slate-600"}`} data-testid={`chat-thread-preview-${t.seller.slug}`}>
                <span className="min-w-0 flex-1 truncate">
                  {t.lastSender && <span className={t.unread > 0 ? "" : "text-slate-500"}>{SENDER_LABEL[t.lastSender]}: </span>}
                  {t.lastText}
                </span>
                {t.unread > 0 && (
                  <span data-testid={`chat-thread-unread-${t.seller.slug}`} className="shrink-0 rounded-full bg-indigo-600 px-2 py-0.5 text-[11px] font-semibold text-white">
                    {t.unread > 9 ? "9+" : t.unread} new
                    <span className="sr-only"> {t.unread === 1 ? "message" : "messages"} you have not read</span>
                  </span>
                )}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <StatusBadge status={t.status} />
                <span className="text-xs text-slate-500">{statusHint(t.status)}</span>
                {t.productName && <span className="text-xs text-slate-500">About {t.productName}</span>}
              </div>
            </div>
          </Link>
        </li>
      ))}
    </ul>
    </>
  );
}

// Shown after a one-time link was refused; the link route redirects here with ?link=invalid.
export function LinkNotice() {
  const invalid = useSearchParams().get("link") === "invalid";
  if (!invalid) return null;
  return (
    <p role="alert" data-testid="chats-link-invalid" className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      This link has expired or was already used. Create a new link on your other device.
    </p>
  );
}
