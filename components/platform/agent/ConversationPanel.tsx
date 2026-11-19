"use client";

import { useEffect, useRef, type RefObject } from "react";
import { ArrowLeft, Languages, MessageSquare, PanelRight, Sparkles } from "lucide-react";
import Composer from "@/components/platform/agent/Composer";
import MessageBubble from "@/components/platform/agent/MessageBubble";
import { Empty, focusRing, Initials, LangPill, StatusPill } from "@/components/platform/agent/desk-ui";
import type { StaffMe } from "@/lib/v2/client";
import type { ThreadDetail } from "@/lib/v2/desk-types";

type Props = {
  detail: ThreadDetail;
  staff: StaffMe;
  drafts: RefObject<Map<string, string>>;
  swapped: boolean;
  onSwap: () => void;
  onBack: () => void;
  onOpenDetails: () => void;
  onSent: (message: string) => void;
  onReopen: () => void;
};

// Header, AI summary, message log and composer for the open conversation.
export default function ConversationPanel({ detail, staff, drafts, swapped, onSwap, onBack, onOpenDetails, onSent, onReopen }: Props) {
  const { thread, buyer, messages } = detail;
  const logRef = useRef<HTMLDivElement>(null);
  const count = messages.length;

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [thread.id, count]);

  return (
    <>
      <header className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-slate-800 bg-[#111827] px-4 py-3" data-testid="conversation-header">
        <button type="button" onClick={onBack} aria-label="Back to the queue" data-testid="back-to-list-btn" className={`rounded-md p-1.5 text-slate-300 hover:bg-slate-800 lg:hidden ${focusRing}`}>
          <ArrowLeft className="h-5 w-5" />
        </button>
        <Initials name={buyer.label} />
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-heading font-semibold tracking-tight text-slate-100" data-testid="conversation-title">
            {buyer.label}
          </h2>
          <p className="truncate text-xs text-slate-400" data-testid="conversation-subject">
            {thread.subject || "No subject yet"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <LangPill language={thread.language} />
          <StatusPill status={thread.status} />
          <span data-testid="conversation-assignee" className="text-xs text-slate-300">
            {thread.assignedStaff ? `Agent: ${thread.assignedStaff.name}` : "Unassigned"}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={onSwap} aria-pressed={swapped} title="Choose which language is shown large" data-testid="translate-toggle-btn" className={`inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-slate-100 hover:bg-slate-700 ${focusRing}`}>
            <Languages className="h-3.5 w-3.5" aria-hidden="true" />
            Large text: {swapped ? (thread.language ?? "Original") : "English"}
          </button>
          <button type="button" onClick={onOpenDetails} data-testid="open-details-btn" className={`inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-slate-100 hover:bg-slate-700 lg:hidden ${focusRing}`}>
            <PanelRight className="h-3.5 w-3.5" aria-hidden="true" /> Details
          </button>
        </div>
      </header>

      {thread.summary && (
        <div data-testid="ai-summary-strip" className="flex shrink-0 items-start gap-2 border-b border-violet-400/20 bg-violet-500/10 px-4 py-2.5">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-violet-400" aria-hidden="true" />
          <p className="text-sm text-violet-100">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-wide text-violet-300">AI summary </span>
            {thread.summary}
          </p>
        </div>
      )}

      <div ref={logRef} role="log" aria-label="Messages" data-testid="message-list" className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <Empty icon={<MessageSquare className="h-8 w-8" />} title="No messages yet" text="This conversation has no messages. Write the first reply below." testId="messages-empty" />
        ) : (
          messages.map((m) => <MessageBubble key={m.id} message={m} buyerLanguage={thread.language} swapped={swapped} />)
        )}
      </div>

      <div className="max-h-[62%] shrink-0 overflow-y-auto border-t border-slate-800 bg-[#0E1524]">
        <Composer key={thread.id} thread={thread} staff={staff} drafts={drafts} onSent={onSent} onReopen={onReopen} />
      </div>
    </>
  );
}
