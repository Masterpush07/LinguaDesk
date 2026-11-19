"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { AlertCircle, CheckCircle2, Copy, RefreshCw, Sparkles, X } from "lucide-react";

import { FOCUS, BTN_GHOST } from "@/components/platform/seller/styles";

// Small building blocks shared by the seller studio screens.

export { BTN_DANGER, BTN_GHOST, BTN_PRIMARY, FOCUS, INPUT } from "@/components/platform/seller/styles";

export function LoadingBlock({ label, testId = "loading-state", rows = 3 }: { label: string; testId?: string; rows?: number }) {
  return (
    <div role="status" aria-busy="true" data-testid={testId} className="space-y-3">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-16 animate-pulse rounded-2xl bg-slate-200/70 motion-reduce:animate-none" />
      ))}
    </div>
  );
}

export function ErrorBlock({ message, onRetry, testId = "error-state" }: { message: string; onRetry?: () => void; testId?: string }) {
  return (
    <div role="alert" data-testid={testId} className="flex flex-wrap items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
      <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
      <p className="min-w-0 flex-1">{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} data-testid={`${testId}-retry`} className={`${BTN_GHOST} !px-3 !py-1.5`}>
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          Try again
        </button>
      )}
    </div>
  );
}

// Copies text and tells the user whether it worked, since the clipboard can be blocked by the browser.
export function CopyButton({ text, label, testId, className = BTN_GHOST }: { text: string; label: string; testId: string; className?: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
    } catch {
      setState("failed");
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), 2500);
  };

  return (
    <button type="button" onClick={copy} data-testid={testId} className={className}>
      <Copy className="h-4 w-4" aria-hidden="true" />
      {label}
      <span role="status" aria-live="polite" className="sr-only">
        {state === "copied" ? "Copied to the clipboard." : state === "failed" ? "Copying failed. Select the text and copy it manually." : ""}
      </span>
      {state === "copied" && <span aria-hidden="true" className="text-xs font-semibold text-emerald-600">Copied</span>}
      {state === "failed" && <span aria-hidden="true" className="text-xs font-semibold text-red-600">Copy failed</span>}
    </button>
  );
}

export function Card({ children, className = "", testId }: { children: ReactNode; className?: string; testId?: string }) {
  return (
    <section data-testid={testId} className={`rounded-2xl border border-slate-200 bg-white p-5 ${className}`}>
      {children}
    </section>
  );
}

export function AiStatusBadge({ label = "AI assistant is live" }: { label?: string }) {
  return (
    <span
      data-testid="ai-status-badge"
      className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-violet-600 via-indigo-600 to-cyan-500 px-3 py-1 text-xs font-semibold text-white shadow-[0_0_18px_rgba(99,102,241,0.55)]"
    >
      <Sparkles className="h-3.5 w-3.5 motion-safe:animate-pulse" aria-hidden="true" />
      {label}
    </span>
  );
}

// Always mounted so screen readers announce text changes politely.
export function Notice({ message, testId = "save-confirmation" }: { message: string; testId?: string }) {
  return (
    <div role="status" aria-live="polite" data-testid={testId} className="min-h-6">
      {message && (
        <p className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700 ring-1 ring-emerald-200">
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          {message}
        </p>
      )}
    </div>
  );
}

export function FieldError({ id, message, testId }: { id: string; message?: string; testId: string }) {
  return (
    <p id={id} role="alert" data-testid={testId} className="mt-1 min-h-4 text-xs font-medium text-red-600">
      {message}
    </p>
  );
}

export function Toggle({ checked, onChange, label, testId }: { checked: boolean; onChange: (v: boolean) => void; label: string; testId: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      data-testid={testId}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors motion-reduce:transition-none ${checked ? "bg-indigo-600" : "bg-slate-300"} ${FOCUS}`}
    >
      <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform motion-reduce:transition-none ${checked ? "translate-x-5.5" : "translate-x-0.5"}`} />
    </button>
  );
}

type DialogProps = { title: string; description?: string; onClose: () => void; children: ReactNode; testId: string; side?: boolean };

// Modal dialog (centered) or right-hand drawer. Escape closes it and focus moves inside when it opens.
export function Dialog({ title, description, onClose, children, testId, side = false }: DialogProps) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);

  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, []);

  return (
    <div className={`fixed inset-0 z-50 flex bg-slate-900/50 ${side ? "justify-end" : "items-center justify-center p-4"}`} data-testid={`${testId}-overlay`}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        data-testid={testId}
        className={`flex flex-col bg-white shadow-2xl focus:outline-none ${side ? "h-full w-full max-w-md overflow-y-auto p-6" : "max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-2xl p-6"}`}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="font-heading text-lg font-semibold text-slate-900">{title}</h2>
            {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label={`Close ${title}`} data-testid={`${testId}-close`} className={`rounded-full p-1.5 text-slate-500 hover:bg-slate-100 ${FOCUS}`}>
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Label({ htmlFor, children, hint }: { htmlFor: string; children: ReactNode; hint?: string }) {
  return (
    <div className="mb-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-slate-800">
        {children}
      </label>
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  );
}
