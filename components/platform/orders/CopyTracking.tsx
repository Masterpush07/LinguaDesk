"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";

export default function CopyTracking({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={() => void copy()}
        data-testid="order-copy-tracking"
        aria-label={copied ? "Tracking number copied" : "Copy tracking number"}
        className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-indigo-300 hover:text-indigo-700 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
        {copied ? "Copied" : "Copy"}
      </button>
      <span className="sr-only" role="status" aria-live="polite" data-testid="order-copy-status">
        {copied ? "Tracking number copied to clipboard" : ""}
      </span>
    </span>
  );
}
