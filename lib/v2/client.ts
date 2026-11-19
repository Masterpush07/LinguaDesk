"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export type StaffMe = {
  id: string;
  sellerId: string;
  name: string;
  role: "owner" | "agent";
  languages: string[];
  sellerSlug: string;
  sellerName: string;
  nexconnUserId: string;
};

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

// JSON fetch that throws ApiError with the server's message, so screens can show a precise reason.
export async function api<T>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  const res = await fetch(url, {
    ...rest,
    headers: json !== undefined ? { "Content-Type": "application/json", ...rest.headers } : rest.headers,
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  const body = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!res.ok) throw new ApiError(res.status, body?.error ?? `Request failed (${res.status})`);
  return body as T;
}

// Loads the signed-in staff member. Sends signed-out visitors to /login, and agents away from owner-only screens.
export function useStaff(options: { owner?: boolean } = {}): StaffMe | null {
  const router = useRouter();
  const [staff, setStaff] = useState<StaffMe | null>(null);
  const ownerOnly = options.owner ?? false;

  useEffect(() => {
    let alive = true;
    api<StaffMe>("/api/auth/me")
      .then((me) => {
        if (!alive) return;
        if (ownerOnly && me.role !== "owner") router.replace("/agent");
        else setStaff(me);
      })
      .catch(() => {
        if (alive) router.replace("/login");
      });
    return () => {
      alive = false;
    };
  }, [router, ownerOnly]);

  return staff;
}

// Tells the server this person is at their desk, so dispatch can assign chats to them. Stops when the tab closes.
export function useHeartbeat(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const beat = () => void fetch("/api/desk/heartbeat", { method: "POST" }).catch(() => {});
    beat();
    const id = setInterval(beat, 30_000);
    return () => clearInterval(id);
  }, [enabled]);
}
