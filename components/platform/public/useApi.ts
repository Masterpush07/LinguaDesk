"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/v2/client";

type State<T> = { key: string; data: T | null; error: { status: number; message: string } | null };

// Fetches JSON from an API route. Loading is derived (the stored result belongs to an older request), so no state is set synchronously inside the effect.
// Pass null to skip the request.
export function useApi<T>(url: string | null) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<State<T>>({ key: "", data: null, error: null });
  const key = `${attempt}:${url}`;

  useEffect(() => {
    if (url === null) return;
    let alive = true;
    api<T>(url)
      .then((data) => alive && setState({ key, data, error: null }))
      .catch((err: unknown) => {
        if (!alive) return;
        const status = err instanceof ApiError ? err.status : 0;
        setState((prev) => ({ key, data: prev.data, error: { status, message: err instanceof Error ? err.message : "Something went wrong." } }));
      });
    return () => {
      alive = false;
    };
  }, [url, key]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  const loading = url !== null && state.key !== key;
  // data keeps the last successful result while a newer request is in flight, so filters do not flash empty.
  return { data: state.data, error: loading ? null : state.error, loading, retry };
}
