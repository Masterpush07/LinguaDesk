"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError, type StaffMe } from "@/lib/v2/client";

// Browser-only helpers shared by the agent desk screens.

export const DeskContext = createContext<StaffMe | null>(null);

// The signed-in team member. Screens under the agent shell render only after they are known.
export function useDeskStaff(): StaffMe {
  const staff = useContext(DeskContext);
  if (!staff) throw new Error("useDeskStaff must be used inside the agent shell");
  return staff;
}

export const REFRESH_EVENT = "desk:refresh";

// Fires on live messages (shell), on window focus and on a 20 second timer while the tab is visible.
export function useDeskRefresh(refetch: () => void) {
  const latest = useRef(refetch);
  useEffect(() => {
    latest.current = refetch;
  });
  useEffect(() => {
    const run = () => latest.current();
    const visibleRun = () => {
      if (document.visibilityState === "visible") run();
    };
    window.addEventListener(REFRESH_EVENT, run);
    window.addEventListener("focus", run);
    document.addEventListener("visibilitychange", visibleRun);
    const id = setInterval(visibleRun, 20_000);
    return () => {
      window.removeEventListener(REFRESH_EVENT, run);
      window.removeEventListener("focus", run);
      document.removeEventListener("visibilitychange", visibleRun);
      clearInterval(id);
    };
  }, []);
}

type DataState<T> = { url: string | null; data: T | null; error: string | null };

// Loads JSON from an API route and keeps it fresh. Data from a previous url is never shown for the new one.
export function useDeskData<T>(url: string | null) {
  const router = useRouter();
  const [state, setState] = useState<DataState<T>>({ url: null, data: null, error: null });
  const current = useRef(url);
  useEffect(() => {
    current.current = url;
  });

  const load = useCallback(async () => {
    if (!url) return;
    try {
      const data = await api<T>(url);
      if (current.current === url) setState({ url, data, error: null });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.replace("/login");
        return;
      }
      if (current.current === url) {
        setState((s) => ({ url, data: s.url === url ? s.data : null, error: err instanceof Error ? err.message : "Something went wrong." }));
      }
    }
  }, [url, router]);

  useEffect(() => {
    void load();
  }, [load]);
  useDeskRefresh(load);

  const matches = state.url === url;
  return { data: matches ? state.data : null, error: matches ? state.error : null, loading: !!url && !matches, reload: load };
}

// One shared one-second clock, so countdowns never call Date.now() during render.
const clock = {
  value: 0,
  listeners: new Set<() => void>(),
  timer: null as ReturnType<typeof setInterval> | null,
};

function subscribeClock(listener: () => void) {
  clock.listeners.add(listener);
  if (clock.listeners.size === 1) {
    clock.value = Date.now();
    clock.timer = setInterval(() => {
      clock.value = Date.now();
      clock.listeners.forEach((l) => l());
    }, 1000);
  }
  return () => {
    clock.listeners.delete(listener);
    if (clock.listeners.size === 0 && clock.timer) {
      clearInterval(clock.timer);
      clock.timer = null;
    }
  };
}

// Milliseconds since 1970, updated every second. 0 until the first client tick.
export function useNow(): number {
  return useSyncExternalStore(subscribeClock, () => clock.value, () => 0);
}

export function formatClockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

// "3 min ago" style label. now = 0 (before the first tick) falls back to the clock time.
export function timeAgo(iso: string, now: number): string {
  if (!now) return formatClockTime(iso);
  const seconds = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return formatDateTime(iso);
}

export const formatUsd = (n: number) => `$${n.toLocaleString("en-US")}`;
