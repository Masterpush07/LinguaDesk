"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRightLeft, Bot, ChevronDown, CircleCheck, Flame, History, NotebookPen, PackagePlus, RotateCcw, Sparkles, UserCheck } from "lucide-react";
import OrderBuilder from "@/components/platform/agent/OrderBuilder";
import { focusRing, Initials, LangPill, StatusPill, statusHint } from "@/components/platform/agent/desk-ui";
import { api, type StaffMe } from "@/lib/v2/client";
import { formatDateTime, formatUsd } from "@/lib/v2/desk-client";
import type { DeskEvent, ThreadDetail } from "@/lib/v2/desk-types";

export type DeskAction = "claim" | "transfer" | "escalate" | "resolve" | "reopen" | "handback";

type Props = {
  detail: ThreadDetail;
  staff: StaffMe;
  onBack: () => void;
  onAction: (action: DeskAction, staffId?: string) => Promise<void>;
  onChanged: (message?: string) => void;
};

const btn = `inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-45 ${focusRing}`;

const NEXT_STEP = {
  ai: "Next: read along. Reply or choose Claim to take over.",
  waiting: "Next: claim this conversation or reply. Replying assigns it to you.",
  assigned: "Next: reply to the buyer. When the issue is solved, choose Resolve.",
  resolved: "Next: nothing is needed. Choose Reopen if the buyer writes again.",
} as const;

const CONFIRMED = ["confirmed", "packed", "shipped", "delivered"];

function Section({ title, icon, children, testId }: { title: string; icon?: ReactNode; children: ReactNode; testId: string }) {
  return (
    <section className="border-b border-slate-800 px-4 py-4" data-testid={testId} aria-label={title}>
      <h3 className="mb-2.5 flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        {icon}
        {title}
      </h3>
      {children}
    </section>
  );
}

const text = (v: unknown): string => (typeof v === "string" ? v : "");
const nameOf = (v: unknown): string => (v && typeof v === "object" && "name" in v ? text((v as { name: unknown }).name) : "");

function describe(e: DeskEvent): string {
  const p = e.payload;
  const who = text(p.name);
  switch (e.type) {
    case "handoff":
      return e.actor === "ai" && p.reason === "ai_unavailable" ? "AI unavailable, an agent was requested" : "AI requested an agent";
    case "assigned":
      return e.actor === "dispatch" ? `Dispatch assigned to ${who}` : `Assigned to ${who}${text(p.by) ? ` by ${text(p.by)}` : ""}`;
    case "claimed":
      return `${who} took the conversation`;
    case "transferred":
      return `${who ? `${who} transferred` : "Transferred"} ${nameOf(p.from) ? `from ${nameOf(p.from)} ` : ""}to ${nameOf(p.to)}`;
    case "escalated":
      return `${who} escalated to Critical`;
    case "resolved":
      return `${who} resolved the conversation`;
    case "reopened":
      return e.actor === "buyer" ? "The buyer wrote again and reopened it" : `${who} reopened the conversation`;
    case "handed_back":
      return `${who} handed the conversation back to the AI`;
    case "replied":
      return `${who} replied${p.original === true ? " (original, untranslated)" : ""}`;
    case "order_sent":
      return `${who} sent an order card${typeof p.total === "number" ? ` for ${formatUsd(p.total)}` : ""}`;
    case "note_added":
      return `${who} added an internal note`;
    default:
      return e.type.replace(/_/g, " ");
  }
}

export default function InboxDetails({ detail, staff, onBack, onAction, onChanged }: Props) {
  const { thread, buyer, orders, product, team, notes, events } = detail;
  const [transferOpen, setTransferOpen] = useState(false);
  const [orderOpen, setOrderOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [note, setNote] = useState("");
  const [noteBusy, setNoteBusy] = useState(false);
  const [noteError, setNoteError] = useState("");

  const owner = staff.role === "owner";
  const mine = thread.assignedStaff?.id === staff.id;
  const resolved = thread.status === "resolved";
  const canWork = owner || !thread.assignedStaff || mine;
  const spent = orders.filter((o) => CONFIRMED.includes(o.status)).reduce((sum, o) => sum + o.total, 0);

  async function run(action: DeskAction, staffId?: string) {
    setPending(true);
    try {
      await onAction(action, staffId);
    } finally {
      setPending(false);
    }
  }

  async function submitNote() {
    const value = note.trim();
    if (!value || noteBusy) return;
    setNoteBusy(true);
    setNoteError("");
    try {
      await api(`/api/desk/threads/${thread.id}/notes`, { method: "POST", json: { text: value } });
      setNote("");
      onChanged("Internal note added. Only your team can see it.");
    } catch (err) {
      setNoteError(err instanceof Error ? err.message : "The note could not be saved.");
    } finally {
      setNoteBusy(false);
    }
  }

  return (
    <div className="flex flex-col" data-testid="agent-details-panel">
      <div className="flex items-center gap-2 border-b border-slate-800 px-4 py-3 lg:hidden">
        <button type="button" onClick={onBack} data-testid="details-back-btn" className={`${btn} bg-slate-800 text-slate-100 hover:bg-slate-700`}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to chat
        </button>
      </div>

      <Section title="Buyer" testId="customer-dossier">
        <div className="flex items-center gap-3">
          <Initials name={buyer.label} size="h-11 w-11" />
          <div className="min-w-0">
            <p className="truncate font-heading font-semibold tracking-tight text-slate-100" data-testid="dossier-name">
              {buyer.label}
            </p>
            <p className="mt-0.5">
              <LangPill language={thread.language ?? buyer.language} />
            </p>
          </div>
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-lg bg-[#111827] p-2.5 ring-1 ring-slate-800">
            <dt className="text-[11px] text-slate-400">Orders with this shop</dt>
            <dd className="font-heading text-lg font-semibold text-slate-100" data-testid="dossier-orders">
              {orders.length}
            </dd>
          </div>
          <div className="rounded-lg bg-[#111827] p-2.5 ring-1 ring-slate-800">
            <dt className="text-[11px] text-slate-400">Confirmed spend</dt>
            <dd className="font-heading text-lg font-semibold text-slate-100" data-testid="dossier-spend">
              {formatUsd(spent)}
            </dd>
          </div>
        </dl>
      </Section>

      <Section title="Actions" testId="agent-actions">
        <div className="rounded-lg bg-[#111827] p-3 ring-1 ring-slate-800" data-testid="handoff-explanation">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill status={thread.status} />
            <span className="text-xs text-slate-300" data-testid="details-assignee">
              {thread.assignedStaff ? `Handled by ${thread.assignedStaff.name}` : "Not assigned to anyone"}
            </span>
          </div>
          <p className="mt-1.5 text-xs text-slate-400">{statusHint(thread.status)}</p>
          <p className="mt-1 text-xs text-slate-300">{NEXT_STEP[thread.status]}</p>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button type="button" onClick={() => void run("claim")} disabled={pending || resolved || mine || (!owner && !!thread.assignedStaff)} data-testid="claim-btn" className={`${btn} bg-indigo-500 text-white hover:bg-indigo-400`}>
            <UserCheck className="h-4 w-4" aria-hidden="true" /> Claim
          </button>
          <button
            type="button"
            onClick={() => setTransferOpen((o) => !o)}
            disabled={pending || resolved || (!owner && !mine)}
            aria-expanded={transferOpen}
            aria-controls="transfer-menu"
            data-testid="transfer-btn"
            className={`${btn} bg-slate-800 text-slate-100 hover:bg-slate-700`}
          >
            <ArrowRightLeft className="h-4 w-4" aria-hidden="true" /> Transfer
            <ChevronDown className={`h-3.5 w-3.5 transition motion-reduce:transition-none ${transferOpen ? "rotate-180" : ""}`} aria-hidden="true" />
          </button>
          <button type="button" onClick={() => void run("escalate")} disabled={pending || resolved || thread.priority === "critical"} data-testid="escalate-btn" className={`${btn} bg-red-500/15 text-red-300 ring-1 ring-red-400/30 hover:bg-red-500/25`}>
            <Flame className="h-4 w-4" aria-hidden="true" /> Escalate
          </button>
          {resolved ? (
            <button type="button" onClick={() => void run("reopen")} disabled={pending || !canWork} data-testid="reopen-btn" className={`${btn} bg-slate-800 text-slate-100 hover:bg-slate-700`}>
              <RotateCcw className="h-4 w-4" aria-hidden="true" /> Reopen
            </button>
          ) : (
            <button type="button" onClick={() => void run("resolve")} disabled={pending || !canWork} data-testid="resolve-btn" className={`${btn} bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/30 hover:bg-emerald-500/25`}>
              <CircleCheck className="h-4 w-4" aria-hidden="true" /> Resolve
            </button>
          )}
          <button
            type="button"
            onClick={() => void run("handback")}
            disabled={pending || !(thread.status === "assigned" || thread.status === "waiting") || !canWork}
            data-testid="handback-btn"
            className={`${btn} col-span-2 bg-violet-500/15 text-violet-200 ring-1 ring-violet-400/30 hover:bg-violet-500/25`}
          >
            <Bot className="h-4 w-4" aria-hidden="true" /> Hand back to the AI
          </button>
        </div>
        {thread.priority === "critical" && !resolved && <p className="mt-2 text-xs text-red-300">Already marked Critical, so Escalate is unavailable.</p>}
        {!canWork && !resolved && <p className="mt-2 text-xs text-slate-400">This conversation is assigned to another agent. Only they or the owner can act on it.</p>}

        {transferOpen && (
          <ul id="transfer-menu" data-testid="transfer-menu" className="mt-2 space-y-1 rounded-lg border border-slate-700 bg-[#111827] p-1.5">
            {team.map((m) => {
              const current = m.id === thread.assignedStaff?.id;
              const full = m.load >= m.maxConcurrent && !current && !owner;
              const speaks = thread.language !== null && m.languages.some((l) => thread.language?.toLowerCase().startsWith(l));
              return (
                <li key={m.id}>
                  <button
                    type="button"
                    disabled={pending || full || current}
                    onClick={() => {
                      setTransferOpen(false);
                      void run("transfer", m.id);
                    }}
                    data-testid={`transfer-option-${m.id}`}
                    className={`flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left hover:bg-[#172033] disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`}
                  >
                    <Initials name={m.name} size="h-8 w-8" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-slate-100">{m.name}</span>
                      <span className="block text-[11px] text-slate-400">
                        {m.languages.join(", ")} · load {m.load}/{m.maxConcurrent}
                        {speaks ? " · speaks this language" : ""}
                      </span>
                    </span>
                    <span className="text-[11px] text-slate-400">{current ? "Current" : full ? "At capacity" : !m.online ? "Offline" : m.available ? "Available" : "Away"}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <Section title="AI summary" icon={<Sparkles className="h-3.5 w-3.5 text-violet-400" aria-hidden="true" />} testId="ai-summary-panel">
        <p className="text-sm text-slate-200" data-testid="ai-summary-text">
          {thread.summary ?? "No summary yet. The AI writes one when it asks for an agent."}
        </p>
        {owner && events.some((e) => e.type === "handoff" && e.payload.reason !== "ai_unavailable") && (
          <Link href={`/seller/knowledge?thread=${encodeURIComponent(thread.id)}`} data-testid="teach-assistant-link" className={`mt-2 inline-block text-xs font-medium text-violet-300 underline underline-offset-2 hover:text-violet-200 ${focusRing}`}>
            Teach the assistant
          </Link>
        )}
      </Section>

      <Section title="Order card" icon={<PackagePlus className="h-3.5 w-3.5" aria-hidden="true" />} testId="order-builder-section">
        {orderOpen ? (
          <OrderBuilder
            threadId={thread.id}
            onClose={() => setOrderOpen(false)}
            onSent={(message) => {
              setOrderOpen(false);
              onChanged(message);
            }}
          />
        ) : (
          <button type="button" onClick={() => setOrderOpen(true)} disabled={resolved || !canWork} data-testid="open-order-builder-btn" className={`${btn} w-full bg-slate-800 text-slate-100 hover:bg-slate-700`}>
            <PackagePlus className="h-4 w-4" aria-hidden="true" /> Build an order card
          </button>
        )}
      </Section>

      <Section title="Order history" testId="order-history">
        {orders.length === 0 ? (
          <p className="text-sm text-slate-400" data-testid="orders-empty">
            No orders yet for this buyer. They may be asking before buying.
          </p>
        ) : (
          <ul className="space-y-2">
            {orders.map((o) => (
              <li key={o.id} data-testid={`order-item-${o.id}`} className="rounded-lg bg-[#111827] p-2.5 ring-1 ring-slate-800">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-mono text-xs font-semibold text-slate-100">{o.id}</span>
                  <span className="rounded-full bg-slate-700/40 px-2 py-0.5 text-[10px] font-semibold capitalize text-slate-200 ring-1 ring-slate-600" data-testid={`order-status-${o.id}`}>
                    {o.status}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  {formatUsd(o.total)} · {formatDateTime(o.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Product" testId="product-preview">
        {product ? (
          <div className="flex gap-3">
            {product.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={product.imageUrl} alt={product.name} className="h-16 w-20 shrink-0 rounded-lg object-cover" />
            )}
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-100" data-testid="product-name">
                {product.name}
              </p>
              <p className="text-sm text-slate-300" data-testid="product-price">
                {formatUsd(product.priceUsd)}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-400" data-testid="product-empty">
            No product is linked to this conversation.
          </p>
        )}
      </Section>

      <Section title="Internal notes" icon={<NotebookPen className="h-3.5 w-3.5" aria-hidden="true" />} testId="internal-notes">
        {notes.length === 0 ? (
          <p className="text-sm text-slate-400" data-testid="notes-empty">
            No notes yet. Notes are only visible to the team, never to the buyer.
          </p>
        ) : (
          <ul className="space-y-1.5" data-testid="notes-list">
            {notes.map((n) => (
              <li key={n.id} data-testid={`note-${n.id}`} className="rounded-lg bg-[#111827] p-2 text-sm text-slate-200 ring-1 ring-slate-800">
                <p className="whitespace-pre-wrap break-words">{n.text}</p>
                <p className="mt-1 text-[11px] text-slate-500">
                  {n.staffName ?? "Former team member"} · {formatDateTime(n.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        )}
        <form
          className="mt-2.5 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void submitNote();
          }}
        >
          <label htmlFor="add-note-input" className="sr-only">
            Add an internal note
          </label>
          <input
            id="add-note-input"
            data-testid="add-note-input"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add an internal note"
            className={`min-w-0 flex-1 rounded-lg border border-slate-700 bg-[#0B0F17] px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 ${focusRing}`}
          />
          <button type="submit" disabled={!note.trim() || noteBusy} data-testid="add-note-btn" className={`${btn} bg-slate-800 text-slate-100 hover:bg-slate-700`}>
            Add
          </button>
        </form>
        {noteError && (
          <p role="alert" data-testid="note-error" className="mt-2 text-xs text-red-300">
            {noteError}
          </p>
        )}
      </Section>

      <Section title="History" icon={<History className="h-3.5 w-3.5" aria-hidden="true" />} testId="event-timeline">
        {events.length === 0 ? (
          <p className="text-sm text-slate-400" data-testid="events-empty">
            Nothing has happened in this conversation yet.
          </p>
        ) : (
          <ol className="space-y-2 border-l border-slate-700 pl-3" data-testid="events-list">
            {[...events].reverse().map((e, i) => (
              <li key={`${e.at}-${i}`} data-testid={`event-${e.type}`} className="text-xs">
                <p className="text-slate-200">{describe(e)}</p>
                <p className="text-slate-500">{formatDateTime(e.at)}</p>
              </li>
            ))}
          </ol>
        )}
      </Section>
    </div>
  );
}
