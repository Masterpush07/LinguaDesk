"use client";

import { useEffect, useState } from "react";

const POLL_MS = 30_000;

// The number of unread shop messages for this visitor. Checked every 30 seconds while the page is visible, and when the tab regains focus.
export function useUnreadCount(): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let alive = true;
    const load = () => {
      if (document.visibilityState !== "visible") return;
      fetch("/api/buyer/unread", { cache: "no-store" })
        .then((res) => (res.ok ? (res.json() as Promise<{ count?: number }>) : null))
        .then((body) => {
          if (alive && body && typeof body.count === "number") setCount(body.count);
        })
        .catch(() => undefined);
    };
    load();
    const id = window.setInterval(load, POLL_MS);
    window.addEventListener("focus", load);
    document.addEventListener("visibilitychange", load);
    return () => {
      alive = false;
      window.clearInterval(id);
      window.removeEventListener("focus", load);
      document.removeEventListener("visibilitychange", load);
    };
  }, []);

  return count;
}
