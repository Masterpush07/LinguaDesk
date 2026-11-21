import type { ReactNode } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import type { ThreadPriority, ThreadStatus } from "@/lib/v2/desk-types";

// Small presentational pieces for the agent desk. They take plain strings, so any buyer language works.

export const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500";

export function LangPill({ language }: { language: string | null }) {
  const label = language?.trim() || "Unknown";
  return (
    <span
      data-testid={`language-pill-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
      className="inline-flex items-center rounded-md bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-slate-300"
    >
      {label}
    </span>
  );
}

const PRIORITY: Record<ThreadPriority, { label: string; cls: string }> = {
  critical: { label: "Critical", cls: "bg-red-500/15 text-red-300 ring-red-400/30" },
  high: { label: "High", cls: "bg-amber-400/10 text-amber-300 ring-amber-400/30" },
  normal: { label: "Normal", cls: "bg-slate-700/40 text-slate-300 ring-slate-600" },
};

export function PriorityPill({ priority }: { priority: ThreadPriority }) {
  const p = PRIORITY[priority];
  return (
    <span data-testid={`priority-${priority}`} className={`rounded-md px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide ring-1 ${p.cls}`}>
      {p.label}
    </span>
  );
}

const STATUS: Record<ThreadStatus, { label: string; cls: string; hint: string }> = {
  ai: { label: "Assistant answering", cls: "bg-violet-500/15 text-violet-300 ring-violet-400/30", hint: "The AI assistant is answering this buyer." },
  waiting: { label: "Needs a reply", cls: "bg-amber-400/10 text-amber-300 ring-amber-400/30", hint: "The assistant could not answer, or the buyer asked for the shop. Nobody has picked this up yet." },
  assigned: { label: "With the shop team", cls: "bg-emerald-400/10 text-emerald-300 ring-emerald-400/30", hint: "A member of the shop team is handling this conversation." },
  resolved: { label: "Resolved", cls: "bg-slate-700/40 text-slate-300 ring-slate-600", hint: "This conversation is closed." },
};

export const statusHint = (s: ThreadStatus) => STATUS[s].hint;

export function StatusPill({ status }: { status: ThreadStatus }) {
  const s = STATUS[status];
  return (
    <span data-testid={`status-${status}`} className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${s.cls}`}>
      {s.label}
    </span>
  );
}

export function Loading({ label, testId = "desk-loading" }: { label: string; testId?: string }) {
  return (
    <div role="status" aria-busy="true" data-testid={testId} className="flex items-center justify-center gap-2 px-6 py-12 text-sm text-slate-400">
      <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
      {label}
    </div>
  );
}

export function ErrorNotice({ message, onRetry, testId = "desk-error" }: { message: string; onRetry?: () => void; testId?: string }) {
  return (
    <div role="alert" data-testid={testId} className="flex flex-col items-center px-6 py-10 text-center">
      <AlertCircle className="h-7 w-7 text-red-400" aria-hidden="true" />
      <p className="mt-2 text-sm font-medium text-slate-100">Something went wrong</p>
      <p className="mt-1 max-w-sm text-sm text-slate-400">{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} data-testid={`${testId}-retry-btn`} className={`mt-3 rounded-lg bg-slate-800 px-3 py-2 text-sm font-medium text-slate-100 hover:bg-slate-700 ${focusRing}`}>
          Try again
        </button>
      )}
    </div>
  );
}

export function Empty({ icon, title, text, testId, children }: { icon: ReactNode; title: string; text: string; testId: string; children?: ReactNode }) {
  return (
    <div data-testid={testId} className="flex flex-col items-center px-6 py-12 text-center">
      <span className="text-slate-500" aria-hidden="true">
        {icon}
      </span>
      <p className="mt-2 font-heading font-semibold tracking-tight text-slate-100">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-slate-400">{text}</p>
      {children}
    </div>
  );
}

export function initialsOf(name: string): string {
  const words = name.replace(/[^\p{L}\p{N} ]/gu, "").trim().split(/\s+/).filter(Boolean);
  return ((words[0]?.[0] ?? "?") + (words[1]?.[0] ?? words[0]?.[1] ?? "")).toUpperCase();
}

export function Initials({ name, size = "h-9 w-9" }: { name: string; size?: string }) {
  return (
    <span aria-hidden="true" className={`${size} flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-xs font-semibold text-white`}>
      {initialsOf(name)}
    </span>
  );
}
