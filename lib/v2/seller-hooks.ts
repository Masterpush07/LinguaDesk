"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/v2/client";

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  return "Could not reach the server. Check your connection and try again.";
}

// The browser's own time zone, so "today" and daily charts follow the seller's midnight. Sent as a query parameter.
export const browserTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

type State<T> = { url: string | null; data: T | null; error: string };

// Loads JSON from an API route. Data stays on screen while it reloads, and `update` lets an action patch the list without a refetch.
export function useApi<T>(url: string | null) {
  const [state, setState] = useState<State<T>>({ url: null, data: null, error: "" });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!url) return;
    let alive = true;
    api<T>(url)
      .then((data) => {
        if (alive) setState({ url, data, error: "" });
      })
      .catch((err: unknown) => {
        if (alive) setState((s) => ({ url, data: s.url === url ? s.data : null, error: errorMessage(err) }));
      });
    return () => {
      alive = false;
    };
  }, [url, tick]);

  const reload = useCallback(() => setTick((n) => n + 1), []);
  const update = useCallback((fn: (prev: T) => T) => setState((s) => (s.data === null ? s : { ...s, data: fn(s.data) })), []);
  const current = state.url === url;
  return {
    data: current ? state.data : null,
    error: current ? state.error : "",
    loading: url !== null && !current,
    reload,
    update,
  };
}
