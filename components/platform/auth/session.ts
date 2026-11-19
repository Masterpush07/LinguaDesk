"use client";

import { useEffect, useState } from "react";
import { api, type StaffMe } from "@/lib/v2/client";

const EVENT = "linguadesk:auth-changed";

// Tells every mounted auth control (header, login screen) to reload who is signed in.
export function notifyAuthChanged() {
  window.dispatchEvent(new Event(EVENT));
}

// undefined while loading, null when signed out.
export function useCurrentStaff(): StaffMe | null | undefined {
  const [me, setMe] = useState<StaffMe | null | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    const load = () =>
      api<StaffMe>("/api/auth/me")
        .then((m) => alive && setMe(m))
        .catch(() => alive && setMe(null));
    load();
    window.addEventListener(EVENT, load);
    return () => {
      alive = false;
      window.removeEventListener(EVENT, load);
    };
  }, []);

  return me;
}

export async function signOut() {
  await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
  notifyAuthChanged();
}

export const deskPath = (role: "owner" | "agent") => (role === "owner" ? "/seller" : "/agent");
