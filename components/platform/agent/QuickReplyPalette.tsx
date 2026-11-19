"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CornerDownLeft, MessageSquareText, Search, X } from "lucide-react";
import { Empty, ErrorNotice, Loading } from "@/components/platform/agent/desk-ui";
import { api, ApiError } from "@/lib/v2/client";

export type CannedReply = { id: string; title: string; body: string };

type Props = { onPick: (reply: CannedReply) => void; onClose: () => void };
type Load = { status: "loading" } | { status: "ready"; items: CannedReply[] } | { status: "error"; message: string };

// Command-palette style list of the shop's saved replies. Arrow keys move, Enter inserts, Escape closes.
export default function QuickReplyPalette({ onPick, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    let alive = true;
    api<CannedReply[]>("/api/desk/canned")
      .then((items) => alive && setLoad({ status: "ready", items: Array.isArray(items) ? items : [] }))
      .catch((err: unknown) => {
        if (!alive) return;
        // A missing route simply means no saved replies exist yet.
        if (err instanceof ApiError && err.status === 404) setLoad({ status: "ready", items: [] });
        else setLoad({ status: "error", message: err instanceof Error ? err.message : "Saved replies could not be loaded." });
      });
    return () => {
      alive = false;
    };
  }, [attempt]);

  const items = useMemo(() => {
    if (load.status !== "ready") return [];
    const q = query.trim().toLowerCase();
    return q ? load.items.filter((r) => r.title.toLowerCase().includes(q) || r.body.toLowerCase().includes(q)) : load.items;
  }, [load, query]);

  const active = Math.min(index, Math.max(items.length - 1, 0));

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndex(Math.min(active + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndex(Math.max(active - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (items[active]) onPick(items[active]);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-[#0B0F17]/70 p-4 pt-[12vh]" onMouseDown={onClose} data-testid="quick-reply-backdrop">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Saved replies"
        data-testid="quick-reply-palette"
        onKeyDown={onKeyDown}
        onMouseDown={(e) => e.stopPropagation()}
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-700 bg-[#111827] shadow-2xl"
      >
        <div className="flex items-center gap-2 border-b border-slate-800 px-3 py-2.5">
          <Search className="h-4 w-4 text-slate-400" aria-hidden="true" />
          <label htmlFor="quick-reply-search" className="sr-only">
            Search saved replies
          </label>
          <input
            ref={inputRef}
            id="quick-reply-search"
            data-testid="quick-reply-search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIndex(0);
            }}
            placeholder="Search saved replies"
            className="min-w-0 flex-1 bg-transparent text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
          />
          <button type="button" onClick={onClose} aria-label="Close saved replies" data-testid="quick-reply-close-btn" className="rounded-md p-1 text-slate-400 hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
            <X className="h-4 w-4" />
          </button>
        </div>
        {load.status === "loading" && <Loading label="Loading saved replies" testId="quick-reply-loading" />}
        {load.status === "error" && <ErrorNotice message={load.message} onRetry={() => { setLoad({ status: "loading" }); setAttempt((n) => n + 1); }} testId="quick-reply-error" />}
        {load.status === "ready" && load.items.length === 0 && (
          <Empty icon={<MessageSquareText className="h-8 w-8" />} title="No saved replies yet" text="The shop owner can add saved replies in the seller studio. They appear here for the whole team." testId="quick-reply-empty" />
        )}
        {load.status === "ready" && load.items.length > 0 && (
          <ul role="listbox" aria-label="Saved replies" className="max-h-72 overflow-y-auto p-1.5">
            {items.map((r, i) => (
              <li key={r.id} role="option" aria-selected={i === active}>
                <button
                  type="button"
                  tabIndex={-1}
                  data-testid={`quick-reply-item-${r.id}`}
                  onClick={() => onPick(r)}
                  onMouseEnter={() => setIndex(i)}
                  className={`block w-full rounded-lg px-3 py-2 text-left ${i === active ? "bg-slate-800" : "hover:bg-[#172033]"}`}
                >
                  <span className="block font-mono text-[10px] font-semibold uppercase tracking-wide text-indigo-400">{r.title}</span>
                  <span className="mt-0.5 block text-sm text-slate-200">{r.body}</span>
                </button>
              </li>
            ))}
            {items.length === 0 && (
              <li data-testid="quick-reply-no-match" className="px-3 py-6 text-center text-sm text-slate-400">
                No saved reply matches &ldquo;{query}&rdquo;. Clear the search to see all replies.
              </li>
            )}
          </ul>
        )}
        <p className="flex items-center gap-3 border-t border-slate-800 px-3 py-2 text-[11px] text-slate-400">
          <span className="inline-flex items-center gap-1">
            <CornerDownLeft className="h-3 w-3" aria-hidden="true" /> Enter inserts into the composer
          </span>
          <span>Up and down to move</span>
          <span>Esc to close</span>
        </p>
      </div>
    </div>
  );
}
