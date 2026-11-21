"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { LogOut, Radio, Store } from "lucide-react";
import { signOut as signOutRequest } from "@/components/platform/auth/session";
import { Logo } from "@/components/platform/CustomerHeader";
import NotificationBell from "@/components/platform/NotificationBell";
import { focusRing, Initials } from "@/components/platform/agent/desk-ui";
import { connect, onConnection, onMessage } from "@/lib/nexconn-client";
import { api, useHeartbeat, useStaff } from "@/lib/v2/client";
import { DeskContext, REFRESH_EVENT } from "@/lib/v2/desk-client";

const TABS = [
  { href: "/agent", label: "Inbox", exact: true },
  { href: "/agent/dispatch", label: "Dispatch" },
  { href: "/agent/customers", label: "Customers" },
  { href: "/agent/analytics", label: "Analytics" },
];

type Live = "connecting" | "live" | "offline";

// Connects the desk to live chat. A new buyer message triggers a refresh now and again shortly after, because the server stores the row a moment later.
function useLiveUpdates(enabled: boolean): Live {
  const [live, setLive] = useState<Live>("connecting");
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const refreshSoon = () => {
      for (const ms of [1500, 7000]) {
        const t = setTimeout(() => {
          timers.delete(t);
          window.dispatchEvent(new Event(REFRESH_EVENT));
        }, ms);
        timers.add(t);
      }
    };
    const offMessage = onMessage(refreshSoon);
    const offConnection = onConnection((connected) => {
      if (alive) setLive(connected ? "live" : "connecting");
    });
    api<{ userId: string; token: string }>("/api/desk/token", { method: "POST" })
      .then((session) => connect(session))
      .then(() => alive && setLive("live"))
      .catch(() => alive && setLive("offline"));
    return () => {
      alive = false;
      offMessage();
      offConnection();
      timers.forEach(clearTimeout);
    };
  }, [enabled]);
  return live;
}

const LIVE_LABEL: Record<Live, { text: string; dot: string }> = {
  connecting: { text: "Connecting to live updates", dot: "bg-amber-400" },
  live: { text: "Live updates on", dot: "bg-emerald-400" },
  offline: { text: "Live updates off. The desk refreshes every 20 seconds.", dot: "bg-slate-500" },
};

// Dark command-centre shell for the shop team. Screens fill the space under the top bar.
export default function AgentShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const staff = useStaff();
  useHeartbeat(staff !== null);
  const live = useLiveUpdates(staff !== null);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [availabilityError, setAvailabilityError] = useState("");
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState("");
  const toggling = useRef(false);

  useEffect(() => {
    if (!staff) return;
    let alive = true;
    api<{ available: boolean }>("/api/desk/availability")
      .then((r) => alive && setAvailable(r.available))
      .catch(() => alive && setAvailable(true));
    return () => {
      alive = false;
    };
  }, [staff]);

  const toggleAvailability = useCallback(async () => {
    if (available === null || toggling.current) return;
    toggling.current = true;
    setAvailabilityError("");
    try {
      const r = await api<{ available: boolean }>("/api/desk/availability", { method: "POST", json: { available: !available } });
      setAvailable(r.available);
    } catch (err) {
      setAvailabilityError(err instanceof Error ? err.message : "Your status could not be changed.");
    } finally {
      toggling.current = false;
    }
  }, [available]);

  async function signOut() {
    setSigningOut(true);
    setSignOutError("");
    const failure = await signOutRequest();
    if (failure) {
      setSignOutError(failure);
      setSigningOut(false);
    }
  }

  const liveInfo = LIVE_LABEL[live];

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-[#0B0F17] text-slate-100" data-testid="agent-shell">
      <header className="z-20 flex h-14 shrink-0 items-center gap-3 border-b border-slate-800 bg-slate-900/80 px-4 backdrop-blur-xl">
        <Logo dark />
        <span className="hidden max-w-[10rem] truncate rounded-md bg-slate-800 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-slate-300 sm:inline" data-testid="agent-shop-name">
          {staff ? staff.sellerName : "Agent Desk"}
        </span>
        <nav aria-label="Agent" className="ml-2 flex items-center gap-1">
          {TABS.map((t) => {
            const active = t.exact ? pathname === t.href : pathname.startsWith(t.href);
            return (
              <Link
                key={t.href}
                href={t.href}
                aria-current={active ? "page" : undefined}
                data-testid={`agent-nav-${t.label.toLowerCase()}`}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${active ? "bg-slate-800 text-white" : "text-slate-400 hover:bg-slate-800/60 hover:text-white"}`}
              >
                {t.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <span title={liveInfo.text} data-testid="agent-live-status" className="hidden items-center gap-1.5 text-xs text-slate-400 lg:flex">
            <Radio className="h-3.5 w-3.5" aria-hidden="true" />
            <span className={`h-2 w-2 rounded-full ${liveInfo.dot}`} aria-hidden="true" />
            <span className="sr-only">{liveInfo.text}</span>
          </span>
          {staff && <NotificationBell />}
          {staff && staff.role === "owner" && (
            <Link href="/seller" data-testid="agent-seller-studio-link" className={`hidden items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white sm:inline-flex ${focusRing}`}>
              <Store className="h-4 w-4" aria-hidden="true" /> Seller studio
            </Link>
          )}
          {staff && (
            <button
              type="button"
              role="switch"
              aria-checked={available ?? true}
              disabled={available === null}
              onClick={toggleAvailability}
              data-testid="agent-availability-toggle"
              title={availabilityError || (available ? "You receive new conversations. Select to go away." : "You are away. Select to receive new conversations.")}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition disabled:opacity-50 ${focusRing} ${available ? "bg-emerald-400/10 text-emerald-300 ring-emerald-400/30 hover:bg-emerald-400/20" : "bg-slate-800 text-slate-300 ring-slate-600 hover:bg-slate-700"}`}
            >
              <span className={`h-2 w-2 rounded-full ${available ? "bg-emerald-400" : "bg-slate-500"}`} aria-hidden="true" />
              {available === null ? "Status" : available ? "Available" : "Away"}
            </button>
          )}
          {staff && (
            <span className="hidden items-center gap-2 md:flex" data-testid="agent-identity">
              <Initials name={staff.name} size="h-8 w-8" />
              <span className="leading-tight">
                <span className="block max-w-[9rem] truncate text-sm font-medium text-slate-100">{staff.name}</span>
                <span className="block text-[11px] capitalize text-slate-400">{staff.role}</span>
              </span>
            </span>
          )}
          <button
            type="button"
            onClick={signOut}
            disabled={signingOut || !staff}
            data-testid="agent-signout-btn"
            className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white disabled:opacity-50 ${focusRing}`}
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </header>
      {(availabilityError || signOutError) && (
        <p role="alert" data-testid="agent-availability-error" className="border-b border-red-400/30 bg-red-500/10 px-4 py-1.5 text-center text-xs text-red-200">
          {signOutError || availabilityError}
        </p>
      )}
      <div className="min-h-0 flex-1">
        <DeskContext.Provider value={staff}>{children}</DeskContext.Provider>
      </div>
    </div>
  );
}
