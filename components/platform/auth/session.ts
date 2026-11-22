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
      api<StaffMe | null>("/api/auth/me?optional=1")
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

// Returns an error message when sign-out failed; on success the browser leaves for /login and nothing is returned.
export async function signOut(): Promise<string | null> {
  try {
    const res = await fetch("/api/auth/logout", { method: "POST", cache: "no-store" });
    if (!res.ok) return "You could not be signed out. Please try again.";
  } catch {
    return "You could not be signed out. Check your connection and try again.";
  }
  // A full page load drops every screen kept in memory, so nothing from this session can reappear for the next person.
  // A client-side navigation would keep the previous screens alive, which is exactly what must not happen here.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.assign("/login");
  return null;
}

export const deskPath = (role: "owner" | "agent") => (role === "owner" ? "/seller" : "/agent");
