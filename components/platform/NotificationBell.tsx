"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, MessageSquareText, ShoppingBag, Star, UserRound } from "lucide-react";
import { api } from "@/lib/v2/client";
import PushToggle from "@/components/platform/PushToggle";
import { REFRESH_EVENT } from "@/lib/v2/desk-client";
import type { NotificationKind, NotificationsDto } from "@/lib/v2/notification-types";

const POLL_MS = 30_000;

const ICON: Record<NotificationKind, typeof Bell> = {
  needs_reply: MessageSquareText,
  handoff_requested: UserRound,
  order_confirmed: ShoppingBag,
  order_cancelled: ShoppingBag,
  return_requested: MessageSquareText,
  review_received: Star,
};

const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400";

function ago(iso: string, now: number): string {
  const minutes = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60_000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)} h ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// The shop's alerts. The assistant raises one when it cannot answer a customer; opening it takes the owner straight to that conversation.
export default function NotificationBell() {
  const [data, setData] = useState<NotificationsDto | null>(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const load = useCallback(async () => {
    try {
      const next = await api<NotificationsDto>("/api/desk/notifications", { cache: "no-store" });
      setData(next);
      setFailed(false);
      setNow(Date.now());
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    const first = setTimeout(() => void load(), 0);
    const id = setInterval(() => void load(), POLL_MS);
    const refresh = () => void load();
    window.addEventListener(REFRESH_EVENT, refresh);
    window.addEventListener("focus", refresh);
    return () => {
      clearTimeout(first);
      clearInterval(id);
      window.removeEventListener(REFRESH_EVENT, refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const markRead = useCallback(
    async (ids: string[] | "all") => {
      const covers = (id: string) => ids === "all" || ids.includes(id);
      setData((prev) => {
        if (!prev) return prev;
        const newlyRead = prev.items.filter((i) => !i.read && covers(i.id)).length;
        return {
          unread: ids === "all" ? 0 : Math.max(0, prev.unread - newlyRead),
          items: prev.items.map((i) => (covers(i.id) ? { ...i, read: true } : i)),
        };
      });
      try {
        await api("/api/desk/notifications", { method: "POST", json: ids === "all" ? { all: true } : { ids } });
      } catch {
        void load();
      }
    },
    [load],
  );

  const unread = data?.unread ?? 0;
  const items = data?.items ?? [];

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        data-testid="notification-bell"
        className={`relative inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-300 transition motion-reduce:transition-none hover:bg-slate-800 hover:text-white ${FOCUS}`}
      >
        <Bell className="h-4 w-4" aria-hidden="true" />
        {unread > 0 && (
          <span data-testid="notification-count" className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-400 px-1 text-[10px] font-bold text-slate-950">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div role="dialog" aria-label="Notifications" data-testid="notification-panel" className="fixed inset-x-3 top-[3.75rem] z-50 overflow-hidden rounded-xl border border-slate-700 bg-[#111827] text-slate-100 shadow-2xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[22rem]">
          <div className="flex items-center justify-between gap-3 border-b border-slate-800 px-4 py-3">
            <h2 className="font-heading text-sm font-semibold">Notifications</h2>
            <button
              type="button"
              onClick={() => void markRead("all")}
              disabled={unread === 0}
              data-testid="notification-mark-all"
              className={`rounded-md px-2 py-1 text-xs font-medium text-indigo-300 hover:bg-slate-800 disabled:cursor-not-allowed disabled:text-slate-500 disabled:hover:bg-transparent ${FOCUS}`}
            >
              Mark all as read
            </button>
          </div>

          {failed && !data && (
            <p role="alert" data-testid="notification-error" className="px-4 py-6 text-center text-sm text-red-300">
              Notifications could not be loaded.{" "}
              <button type="button" onClick={() => void load()} className={`font-medium underline underline-offset-2 ${FOCUS}`}>
                Try again
              </button>
            </p>
          )}
          {!failed && !data && <p className="px-4 py-6 text-center text-sm text-slate-400">Loading notifications</p>}
          {data && items.length === 0 && (
            <div data-testid="notification-empty" className="px-4 py-8 text-center">
              <p className="text-sm font-medium text-slate-200">No notifications yet</p>
              <p className="mt-1 text-xs text-slate-400">When your AI assistant cannot answer a customer, you will be alerted here.</p>
            </div>
          )}
          {data && items.length > 0 && (
            <ul className="max-h-[26rem] divide-y divide-slate-800 overflow-y-auto" data-testid="notification-list">
              {items.map((n) => {
                const Icon = ICON[n.kind] ?? Bell;
                const body = (
                  <>
                    <span aria-hidden="true" className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${n.read ? "bg-slate-800 text-slate-400" : "bg-amber-400/10 text-amber-300 ring-1 ring-amber-400/30"}`}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={`block text-sm ${n.read ? "font-medium text-slate-300" : "font-semibold text-white"}`}>{n.title}</span>
                      {n.body && <span className="mt-0.5 line-clamp-2 block text-xs text-slate-400">{n.body}</span>}
                      <span className="mt-1 block text-[11px] text-slate-500">{ago(n.createdAt, now || new Date(n.createdAt).getTime())}</span>
                    </span>
                    {!n.read && <span aria-label="Unread" className="mt-2 h-2 w-2 shrink-0 rounded-full bg-amber-400" />}
                  </>
                );
                const cls = `flex w-full items-start gap-3 px-4 py-3 text-left transition motion-reduce:transition-none hover:bg-slate-800/70 ${FOCUS}`;
                return (
                  <li key={n.id} data-testid={`notification-${n.id}`}>
                    {n.threadId ? (
                      <Link
                        href={`/agent?thread=${encodeURIComponent(n.threadId)}`}
                        onClick={() => {
                          if (!n.read) void markRead([n.id]);
                          setOpen(false);
                        }}
                        className={cls}
                      >
                        {body}
                      </Link>
                    ) : (
                      <button type="button" onClick={() => !n.read && void markRead([n.id])} className={cls}>
                        {body}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          <div data-testid="notification-push-row" className="border-t border-slate-800 px-4 py-3">
            <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Alerts on this device</h3>
            <PushToggle audience="staff" compact tone="dark" />
          </div>

          <Link href="/agent" onClick={() => setOpen(false)} data-testid="notification-open-inbox" className={`block border-t border-slate-800 px-4 py-2.5 text-center text-xs font-medium text-indigo-300 hover:bg-slate-800/70 ${FOCUS}`}>
            Open inbox
          </Link>
        </div>
      )}
    </div>
  );
}
