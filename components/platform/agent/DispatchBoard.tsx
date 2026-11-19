"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Inbox as InboxIcon, Users, Wand2 } from "lucide-react";
import SlaChip from "@/components/platform/SlaChip";
import { ErrorNotice, focusRing, Initials, LangPill, Loading, PriorityPill } from "@/components/platform/agent/desk-ui";
import { api } from "@/lib/v2/client";
import { timeAgo, useDeskData, useDeskStaff, useNow } from "@/lib/v2/desk-client";
import type { DispatchData, RosterMember, ThreadSummary } from "@/lib/v2/desk-types";

function Kpi({ id, label, value, hint, tone, icon }: { id: string; label: string; value: string; hint: string; tone: string; icon: ReactNode }) {
  return (
    <div data-testid={`kpi-${id}`} className="rounded-xl border border-slate-800 bg-[#111827] p-4">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
        <span className={tone} aria-hidden="true">
          {icon}
        </span>
      </div>
      <p className={`mt-2 font-heading text-3xl font-semibold tracking-tight ${tone}`} data-testid={`kpi-${id}-value`}>
        {value}
      </p>
      <p className="mt-1 text-xs text-slate-400">{hint}</p>
    </div>
  );
}

type AssignFn = (thread: ThreadSummary, staffId: string, force: boolean) => void;

function Card({ t, roster, canAssign, owner, busy, onAssign }: { t: ThreadSummary; roster: RosterMember[]; canAssign: boolean; owner: boolean; busy: boolean; onAssign: AssignFn }) {
  const now = useNow();
  return (
    <li data-testid={`dispatch-card-${t.id}`} className="rounded-xl border border-slate-800 bg-[#111827] p-3">
      <div className="flex items-start gap-2.5">
        <Initials name={t.buyer.label} size="h-8 w-8" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-100">{t.buyer.label}</p>
          <p className="truncate text-xs text-slate-400">{t.lastText || t.subject}</p>
        </div>
        {t.slaDueAt ? <SlaChip dueAt={t.slaDueAt} /> : <span className="shrink-0 text-[11px] text-slate-500">{timeAgo(t.lastAt, now)}</span>}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <LangPill language={t.language} />
        <PriorityPill priority={t.priority} />
        <span className="text-xs text-slate-300" data-testid={`dispatch-assignee-${t.id}`}>
          {t.assignedStaff ? t.assignedStaff.name : "No agent yet"}
        </span>
      </div>
      <div className="mt-2.5 flex items-center gap-2">
        {canAssign && (
          <>
            <label htmlFor={`assign-${t.id}`} className="sr-only">
              Assign the conversation with {t.buyer.label} to a team member
            </label>
            <select
              id={`assign-${t.id}`}
              value={t.assignedStaff?.id ?? ""}
              disabled={busy}
              onChange={(e) => {
                const target = roster.find((m) => m.id === e.target.value);
                if (target) onAssign(t, target.id, target.load >= target.maxConcurrent);
              }}
              data-testid={`assign-select-${t.id}`}
              className={`min-w-0 flex-1 rounded-lg border border-slate-700 bg-[#0B0F17] px-2 py-1.5 text-xs text-slate-100 disabled:opacity-60 ${focusRing}`}
            >
              <option value="" disabled>
                Assign to...
              </option>
              {roster.map((m) => {
                const full = m.load >= m.maxConcurrent && m.id !== t.assignedStaff?.id;
                return (
                  <option key={m.id} value={m.id} disabled={full && !owner}>
                    {m.name} · {m.load}/{m.maxConcurrent}
                    {full ? (owner ? " · at capacity, forces" : " · at capacity") : !m.online ? " · offline" : !m.available ? " · away" : ""}
                  </option>
                );
              })}
            </select>
          </>
        )}
        <Link href={`/agent?thread=${t.id}`} data-testid={`dispatch-open-${t.id}`} className={`shrink-0 rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-slate-100 hover:bg-slate-700 ${focusRing}`}>
          Open
        </Link>
      </div>
    </li>
  );
}

function Column({ id, title, hint, items, empty, children }: { id: string; title: string; hint: string; items: ThreadSummary[]; empty: string; children: (t: ThreadSummary) => ReactNode }) {
  return (
    <section aria-label={title} data-testid={`board-column-${id}`} className="flex min-w-0 flex-col rounded-2xl border border-slate-800 bg-[#0E1524]">
      <header className="border-b border-slate-800 px-3 py-2.5">
        <h2 className="flex items-center justify-between font-heading text-sm font-semibold tracking-tight text-slate-100">
          {title}
          <span className="rounded bg-slate-700/60 px-1.5 font-mono text-[11px] tabular-nums" data-testid={`board-count-${id}`}>
            {items.length}
          </span>
        </h2>
        <p className="text-xs text-slate-400">{hint}</p>
      </header>
      <ul className="space-y-2 p-2.5">
        {items.map((t) => children(t))}
        {items.length === 0 && (
          <li data-testid={`board-empty-${id}`} className="rounded-lg border border-dashed border-slate-700 px-3 py-6 text-center text-sm text-slate-400">
            {empty}
          </li>
        )}
      </ul>
    </section>
  );
}

function presence(m: RosterMember): { label: string; dot: string } {
  if (!m.online) return { label: "Offline", dot: "bg-slate-600" };
  return m.available ? { label: "Available", dot: "bg-emerald-400" } : { label: "Away", dot: "bg-amber-400" };
}

export default function DispatchBoard() {
  const staff = useDeskStaff();
  const board = useDeskData<DispatchData>("/api/desk/dispatch");
  const [message, setMessage] = useState<{ text: string; tone: "ok" | "error" } | null>(null);
  const [busy, setBusy] = useState(false);
  const owner = staff.role === "owner";
  const reload = board.reload;

  async function assign(t: ThreadSummary, staffId: string, force: boolean) {
    setBusy(true);
    try {
      const r = await api<{ thread: ThreadSummary }>("/api/desk/dispatch/assign", { method: "POST", json: { threadId: t.id, staffId, force } });
      setMessage({ text: `The conversation with ${t.buyer.label} is now with ${r.thread.assignedStaff?.name ?? "the selected agent"}.`, tone: "ok" });
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : "The conversation could not be assigned.", tone: "error" });
    }
    await reload();
    setBusy(false);
  }

  async function autoAssign() {
    setBusy(true);
    try {
      const r = await api<{ assigned: number; remaining: number }>("/api/desk/dispatch/auto", { method: "POST", json: {} });
      const text =
        r.assigned === 0 && r.remaining === 0
          ? "Nothing to assign. The unassigned queue is empty."
          : `Auto-assign placed ${r.assigned} ${r.assigned === 1 ? "conversation" : "conversations"}. ${r.remaining} remain unassigned${r.remaining > 0 ? " because no available agent has free capacity" : ""}.`;
      setMessage({ text, tone: "ok" });
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : "Auto-assign failed.", tone: "error" });
    }
    await reload();
    setBusy(false);
  }

  const data = board.data;

  return (
    <div className="h-full overflow-y-auto bg-[#0B0F17]" data-testid="dispatch-board">
      <div className="mx-auto max-w-7xl space-y-5 p-4 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-heading text-2xl font-semibold tracking-tight text-slate-100">Dispatch center</h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-400">See who is waiting, who is available and move conversations to the right agent.</p>
          </div>
          <button type="button" onClick={() => void autoAssign()} disabled={busy || !data} data-testid="auto-assign-btn" className={`inline-flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-400 disabled:opacity-50 ${focusRing}`}>
            <Wand2 className="h-4 w-4" aria-hidden="true" /> Auto-assign
          </button>
        </div>

        {message && (
          <p role={message.tone === "error" ? "alert" : "status"} aria-live="polite" data-testid="dispatch-status" className={`rounded-lg border px-3 py-2 text-sm ${message.tone === "ok" ? "border-slate-800 bg-[#111827] text-slate-200" : "border-red-400/30 bg-red-500/10 text-red-200"}`}>
            {message.text}
          </p>
        )}

        {!data && !board.error && <Loading label="Loading the dispatch board" testId="dispatch-loading" />}
        {!data && board.error && <ErrorNotice message={board.error} onRetry={() => void reload()} testId="dispatch-error" />}

        {data && (
          <>
            {board.error && (
              <p role="alert" data-testid="dispatch-stale" className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-sm text-amber-200">
                Could not refresh. Showing the last loaded board.
              </p>
            )}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="dispatch-kpis">
              <Kpi id="queue" label="Unassigned" value={String(data.stats.unassigned)} hint={`${data.stats.waiting} waiting for an agent in total`} tone="text-amber-400" icon={<InboxIcon className="h-4 w-4" />} />
              <Kpi id="breached" label="Breached targets" value={String(data.stats.breached)} hint="First-response target missed" tone={data.stats.breached > 0 ? "text-red-400" : "text-emerald-400"} icon={<AlertTriangle className="h-4 w-4" />} />
              <Kpi id="resolved" label="Resolved today" value={String(data.stats.resolvedToday)} hint="Closed since midnight UTC" tone="text-cyan-400" icon={<CheckCircle2 className="h-4 w-4" />} />
              <Kpi id="online" label="Agents available" value={`${data.stats.onlineStaff}/${data.roster.length}`} hint="At their desk and ready for new conversations" tone="text-emerald-400" icon={<Users className="h-4 w-4" />} />
            </div>

            <div className="grid gap-3 lg:grid-cols-3">
              <Column id="unassigned" title="Unassigned" hint="Waiting for an agent to pick them up" items={data.columns.unassigned} empty="No conversations are waiting. New handoffs from the AI appear here.">
                {(t) => <Card key={t.id} t={t} roster={data.roster} canAssign={owner} owner={owner} busy={busy} onAssign={assign} />}
              </Column>
              <Column id="with-agents" title="With agents" hint="An agent is replying" items={data.columns.assigned} empty="No conversation is with an agent yet.">
                {(t) => <Card key={t.id} t={t} roster={data.roster} canAssign={owner || t.assignedStaff?.id === staff.id} owner={owner} busy={busy} onAssign={assign} />}
              </Column>
              <Column id="resolved" title="Resolved" hint="Closed conversations" items={data.columns.resolved} empty="Nothing has been resolved yet.">
                {(t) => <Card key={t.id} t={t} roster={data.roster} canAssign={false} owner={owner} busy={busy} onAssign={assign} />}
              </Column>
            </div>

            <div className="grid gap-5 lg:grid-cols-3">
              <section aria-label="Team roster" className="lg:col-span-2" data-testid="agent-roster">
                <h2 className="mb-2 font-heading text-sm font-semibold tracking-tight text-slate-100">Team roster</h2>
                {data.roster.some((m) => m.load >= m.maxConcurrent) && (
                  <p data-testid="capacity-note" className="mb-2 flex items-start gap-1.5 text-xs text-amber-300">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    {owner ? "A team member at full capacity can still be chosen in the assign menus; the assignment is forced." : "A team member at full capacity cannot be chosen in the assign menus."}
                  </p>
                )}
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {data.roster.map((m) => {
                    const p = presence(m);
                    const pct = Math.min(100, Math.round((m.load / m.maxConcurrent) * 100));
                    return (
                      <article key={m.id} data-testid={`agent-card-${m.id}`} className="rounded-xl border border-slate-800 bg-[#111827] p-4">
                        <div className="flex items-center gap-3">
                          <Initials name={m.name} size="h-10 w-10" />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-100">{m.name}</p>
                            <p className="truncate text-xs capitalize text-slate-400">{m.role}</p>
                          </div>
                        </div>
                        <p className="mt-2.5 flex items-center gap-1.5 text-xs text-slate-300" data-testid={`agent-status-${m.id}`}>
                          <span className={`h-2 w-2 rounded-full ${p.dot}`} aria-hidden="true" /> {p.label}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {m.languages.map((l) => (
                            <LangPill key={l} language={l} />
                          ))}
                        </div>
                        {m.skills.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {m.skills.map((k) => (
                              <span key={k} className="rounded-md bg-slate-800 px-1.5 py-0.5 text-[11px] text-slate-300">
                                {k}
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="mt-3">
                          <div className="mb-1 flex justify-between text-[11px] text-slate-400">
                            <span>Load</span>
                            <span className="font-mono tabular-nums" data-testid={`agent-load-${m.id}`}>
                              {m.load}/{m.maxConcurrent}
                              {m.load >= m.maxConcurrent ? " · full" : ""}
                            </span>
                          </div>
                          <div role="progressbar" aria-label={`${m.name} load`} aria-valuemin={0} aria-valuemax={m.maxConcurrent} aria-valuenow={m.load} className="h-2 overflow-hidden rounded-full bg-slate-800">
                            <div className={`h-full rounded-full transition-all motion-reduce:transition-none ${pct >= 100 ? "bg-red-400" : pct >= 80 ? "bg-amber-400" : "bg-emerald-400"}`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>

              <section aria-label="How dispatch works" data-testid="routing-rules" className="rounded-2xl border border-slate-800 bg-[#0E1524] p-4">
                <h2 className="font-heading text-sm font-semibold tracking-tight text-slate-100">How dispatch works</h2>
                <ul className="mt-3 list-disc space-y-2 pl-4 text-sm text-slate-300">
                  <li>Only team members who are at their desk and set to Available receive new conversations.</li>
                  <li>An agent who speaks the buyer&apos;s language is preferred, then the one with the lowest load.</li>
                  <li>Nobody receives more conversations than their capacity. The owner can force an assignment.</li>
                  <li>Conversations nobody can take stay in Unassigned until Auto-assign runs or someone claims them.</li>
                </ul>
              </section>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
