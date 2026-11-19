"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Inbox as InboxIcon, Languages, Search, SearchX } from "lucide-react";
import SlaChip from "@/components/platform/SlaChip";
import ConversationPanel from "@/components/platform/agent/ConversationPanel";
import InboxDetails, { type DeskAction } from "@/components/platform/agent/InboxDetails";
import { Empty, ErrorNotice, focusRing, Initials, LangPill, Loading, PriorityPill, StatusPill } from "@/components/platform/agent/desk-ui";
import { api } from "@/lib/v2/client";
import { timeAgo, useDeskData, useDeskStaff, useNow } from "@/lib/v2/desk-client";
import type { ThreadDetail, ThreadFilter, ThreadSummary } from "@/lib/v2/desk-types";

type MobileView = "list" | "chat" | "details";
type Toast = { id: number; text: string; tone: "ok" | "error" };

const FILTERS: { key: ThreadFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "unassigned", label: "Unassigned" },
  { key: "mine", label: "Mine" },
  { key: "critical", label: "Critical" },
];

const DONE: Record<DeskAction, string> = {
  claim: "Claimed. This conversation is now assigned to you.",
  transfer: "Transferred. The new agent can see the full history.",
  escalate: "Escalated. Priority is now Critical and the conversation moves to the top of the queue.",
  resolve: "Resolved. The conversation is closed. Use Reopen if the buyer writes again.",
  reopen: "Reopened. The conversation is back in the queue.",
  handback: "Handed back. The AI answers the buyer until an agent is needed again.",
};

const breached = (t: ThreadSummary, now: number) => now > 0 && t.slaDueAt !== null && new Date(t.slaDueAt).getTime() < now;

function matches(t: ThreadSummary, filter: ThreadFilter, myId: string, now: number): boolean {
  if (filter === "unassigned") return t.status === "waiting" && !t.assignedStaff;
  if (filter === "mine") return t.assignedStaff?.id === myId;
  if (filter === "critical") return t.status !== "resolved" && (t.priority === "critical" || breached(t, now));
  return true;
}

export default function Inbox() {
  const staff = useDeskStaff();
  const requested = useSearchParams().get("thread");
  const now = useNow();
  const list = useDeskData<ThreadSummary[]>("/api/desk/threads");
  const [selectedId, setSelectedId] = useState<string | null>(requested);
  const detail = useDeskData<ThreadDetail>(selectedId ? `/api/desk/threads/${selectedId}` : null);
  const [mobileView, setMobileView] = useState<MobileView>(requested ? "chat" : "list");
  const [filter, setFilter] = useState<ThreadFilter>("all");
  const [query, setQuery] = useState("");
  const [swapped, setSwapped] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<Toast | null>(null);
  const toastSeq = useRef(0);
  const drafts = useRef(new Map<string, string>());

  const threads = list.data;
  const reloadList = list.reload;
  const reloadDetail = detail.reload;

  const counts = useMemo(
    () => Object.fromEntries(FILTERS.map((f) => [f.key, (threads ?? []).filter((t) => matches(t, f.key, staff.id, now)).length])) as Record<ThreadFilter, number>,
    [threads, staff.id, now],
  );
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (threads ?? []).filter(
      (t) => matches(t, filter, staff.id, now) && (!q || t.buyer.label.toLowerCase().includes(q) || t.subject.toLowerCase().includes(q) || t.lastText.toLowerCase().includes(q)),
    );
  }, [threads, filter, query, staff.id, now]);

  const notify = useCallback((text: string, tone: Toast["tone"] = "ok") => {
    toastSeq.current += 1;
    setToast({ id: toastSeq.current, text, tone });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(id);
  }, [toast]);

  const refreshAll = useCallback(async () => {
    await Promise.all([reloadList(), reloadDetail()]);
  }, [reloadList, reloadDetail]);

  const act = useCallback(
    async (action: DeskAction, staffId?: string) => {
      if (!selectedId) return;
      try {
        await api(`/api/desk/threads/${selectedId}/actions`, { method: "POST", json: { action, staffId } });
        notify(DONE[action]);
      } catch (err) {
        notify(err instanceof Error ? err.message : "That action could not be completed.", "error");
      }
      await refreshAll();
    },
    [selectedId, notify, refreshAll],
  );

  const changed = useCallback(
    (message?: string) => {
      if (message) notify(message);
      void refreshAll();
    },
    [notify, refreshAll],
  );

  function open(id: string) {
    setSelectedId(id);
    setMobileView("chat");
  }

  const hasThreads = (threads ?? []).length > 0;

  return (
    <div className="relative grid h-full grid-cols-12 overflow-hidden" data-testid="agent-inbox">
      <aside aria-label="Conversation queue" data-testid="agent-queue-panel" className={`col-span-12 min-h-0 flex-col border-r border-slate-800 bg-[#0E1524] lg:col-span-3 lg:flex ${mobileView === "list" ? "flex" : "hidden"}`}>
        <div className="space-y-2.5 border-b border-slate-800 p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
            <label htmlFor="inbox-search" className="sr-only">
              Search conversations by buyer or message
            </label>
            <input
              id="inbox-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search buyer or message"
              data-testid="inbox-search-input"
              className={`w-full rounded-lg border border-slate-700 bg-[#0B0F17] py-2 pl-9 pr-3 text-sm text-slate-100 placeholder:text-slate-500 ${focusRing}`}
            />
          </div>
          <div role="group" aria-label="Filter conversations" className="flex gap-1">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                aria-pressed={filter === f.key}
                onClick={() => setFilter(f.key)}
                data-testid={`inbox-filter-${f.key}`}
                className={`flex flex-1 items-center justify-center gap-1 rounded-md px-1.5 py-1.5 text-xs font-medium transition ${focusRing} ${filter === f.key ? "bg-slate-800 text-white" : "text-slate-400 hover:bg-[#172033] hover:text-slate-100"}`}
              >
                {f.label}
                <span data-testid={`inbox-count-${f.key}`} className="rounded bg-slate-700/60 px-1 font-mono text-[10px] tabular-nums text-slate-200">
                  {counts[f.key]}
                </span>
              </button>
            ))}
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto" data-testid="agent-conversation-scroll">
          {threads === null && !list.error && <Loading label="Loading conversations" testId="agent-list-loading" />}
          {threads === null && list.error && <ErrorNotice message={list.error} onRetry={() => void reloadList()} testId="agent-list-error" />}
          {threads !== null && list.error && (
            <p role="alert" data-testid="agent-list-stale" className="border-b border-amber-400/30 bg-amber-400/10 px-3 py-1.5 text-xs text-amber-200">
              Could not refresh. Showing the last loaded list.
            </p>
          )}
          {threads !== null && !hasThreads && (
            <Empty icon={<InboxIcon className="h-8 w-8" />} title="No conversations yet" text="When a buyer messages your shop they appear here." testId="agent-list-empty" />
          )}
          {hasThreads && (
            <ul data-testid="agent-conversation-list">
              {visible.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => open(t.id)}
                    aria-current={t.id === selectedId ? "true" : undefined}
                    data-testid={`agent-conversation-item-${t.id}`}
                    className={`flex w-full gap-3 border-b border-slate-800/70 px-3 py-3 text-left transition ${focusRing} focus-visible:ring-inset ${t.id === selectedId ? "bg-slate-800" : "hover:bg-[#172033]"}`}
                  >
                    <Initials name={t.buyer.label} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-semibold text-slate-100">{t.buyer.label}</span>
                        {t.slaDueAt ? <SlaChip dueAt={t.slaDueAt} /> : <span className="shrink-0 text-[11px] text-slate-500">{timeAgo(t.lastAt, now)}</span>}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-slate-400">{t.lastText || t.subject}</span>
                      <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <LangPill language={t.language} />
                        <PriorityPill priority={t.priority} />
                        <StatusPill status={t.status} />
                        {t.assignedStaff?.id === staff.id && <span className="font-mono text-[10px] uppercase tracking-wide text-indigo-400">You</span>}
                        {t.unrepliedBuyerMessages > 0 && (
                          <span data-testid={`unreplied-${t.id}`} title="Buyer messages without a team reply" className="rounded-full bg-indigo-500 px-1.5 text-[10px] font-semibold tabular-nums text-white">
                            {t.unrepliedBuyerMessages}
                          </span>
                        )}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
              {visible.length === 0 && (
                <li>
                  <Empty icon={<SearchX className="h-8 w-8" />} title="No conversations match" text="Nothing fits this search and filter. Clear them to see the whole queue." testId="agent-list-no-match">
                    <button
                      type="button"
                      onClick={() => {
                        setQuery("");
                        setFilter("all");
                      }}
                      data-testid="clear-filters-btn"
                      className={`mt-3 rounded-lg bg-slate-800 px-3 py-2 text-sm font-medium text-slate-100 hover:bg-slate-700 ${focusRing}`}
                    >
                      Clear search and filters
                    </button>
                  </Empty>
                </li>
              )}
            </ul>
          )}
        </div>
      </aside>

      <section aria-label="Conversation" data-testid="agent-conversation-panel" className={`col-span-12 min-h-0 flex-col bg-[#0B0F17] lg:col-span-6 lg:flex ${mobileView === "chat" ? "flex" : "hidden"}`}>
        {!selectedId ? (
          <div data-testid="agent-no-selection" className="flex h-full flex-col items-center justify-center px-6 text-center">
            <Languages className="h-10 w-10 text-slate-600" aria-hidden="true" />
            <p className="mt-3 font-heading text-lg font-semibold tracking-tight text-slate-100">Pick a conversation</p>
            <p className="mt-1 max-w-sm text-sm text-slate-400">Choose a conversation from the queue. You see the buyer&apos;s words in their language with English next to them.</p>
            <button type="button" onClick={() => setMobileView("list")} data-testid="empty-back-to-queue-btn" className={`mt-4 rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-100 lg:hidden ${focusRing}`}>
              Open the queue
            </button>
          </div>
        ) : detail.data ? (
          <ConversationPanel
            detail={detail.data}
            staff={staff}
            drafts={drafts}
            swapped={Boolean(swapped[detail.data.thread.id])}
            onSwap={() => setSwapped((s) => ({ ...s, [selectedId]: !s[selectedId] }))}
            onBack={() => setMobileView("list")}
            onOpenDetails={() => setMobileView("details")}
            onSent={changed}
            onReopen={() => void act("reopen")}
          />
        ) : detail.error ? (
          <ErrorNotice message={detail.error} onRetry={() => void reloadDetail()} testId="agent-detail-error" />
        ) : (
          <Loading label="Loading the conversation" testId="agent-detail-loading" />
        )}
      </section>

      <aside aria-label="Buyer details and actions" data-testid="agent-details-column" className={`col-span-12 min-h-0 overflow-y-auto border-l border-slate-800 bg-[#0E1524] lg:col-span-3 lg:block ${mobileView === "details" ? "block" : "hidden"}`}>
        {detail.data ? (
          <InboxDetails key={detail.data.thread.id} detail={detail.data} staff={staff} onBack={() => setMobileView("chat")} onAction={act} onChanged={changed} />
        ) : (
          <div data-testid="details-empty" className="px-6 py-12 text-center text-sm text-slate-400">
            Select a conversation to see the buyer, orders and actions here.
          </div>
        )}
      </aside>

      <div aria-live="polite" role="status" data-testid="action-toast" className="pointer-events-none absolute bottom-4 left-1/2 z-40 w-[min(92%,28rem)] -translate-x-1/2">
        {toast && (
          <p key={toast.id} className={`rounded-xl border bg-[#111827] px-4 py-2.5 text-center text-sm shadow-xl ${toast.tone === "ok" ? "border-emerald-400/30 text-emerald-200" : "border-red-400/40 text-red-200"}`}>
            {toast.text}
          </p>
        )}
      </div>
    </div>
  );
}
