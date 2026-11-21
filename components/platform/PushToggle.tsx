"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { Bell, BellOff, BellRing } from "lucide-react";
import { api } from "@/lib/v2/client";

type Audience = "staff" | "buyer";
type Capability = "server" | "unsupported" | "ios-install" | "ready";
type Status = "checking" | "off" | "on" | "enabling" | "disabling" | "denied" | "error";

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-1";

const noopSubscribe = () => () => {};

function isStandalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true || window.matchMedia("(display-mode: standalone)").matches;
}

// Push on iOS only exists for a site added to the Home Screen, so a plain browser tab gets the install hint instead.
function detectCapability(): Capability {
  if (!PUBLIC_KEY) return "unsupported";
  if (/iPad|iPhone|iPod/.test(navigator.userAgent) && !isStandalone()) return "ios-install";
  const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  return supported ? "ready" : "unsupported";
}

function keyToBytes(key: string): Uint8Array<ArrayBuffer> {
  const base64 = (key + "=".repeat((4 - (key.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

// Asks the browser to deliver alerts to this device even when the site is closed. Permission is requested only after a click.
export default function PushToggle({ audience, compact = false, tone = "light" }: { audience: Audience; compact?: boolean; tone?: "light" | "dark" }) {
  const capability = useSyncExternalStore<Capability>(noopSubscribe, detectCapability, () => "server");
  const [status, setStatus] = useState<Status>("checking");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (capability !== "ready") return;
    let alive = true;
    const timer = setTimeout(async () => {
      try {
        if (Notification.permission === "denied") {
          if (alive) setStatus("denied");
          return;
        }
        const registration = await navigator.serviceWorker.getRegistration("/sw.js");
        const existing = await registration?.pushManager.getSubscription();
        if (alive) setStatus(existing ? "on" : "off");
      } catch {
        if (alive) setStatus("off");
      }
    }, 0);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [capability]);

  const turnOn = useCallback(async () => {
    setStatus("enabling");
    setMessage("");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "off");
        return;
      }
      await navigator.serviceWorker.register("/sw.js");
      const registration = await navigator.serviceWorker.ready;
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(PUBLIC_KEY) }));
      await api("/api/push/subscribe", { method: "POST", json: { audience, subscription: subscription.toJSON() } });
      setStatus("on");
    } catch (err) {
      setMessage(err instanceof Error && err.message ? err.message : "Notifications could not be turned on.");
      setStatus("error");
    }
  }, [audience]);

  const turnOff = useCallback(async () => {
    setStatus("disabling");
    setMessage("");
    try {
      const registration = await navigator.serviceWorker.getRegistration("/sw.js");
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe();
        await api("/api/push/unsubscribe", { method: "POST", json: { endpoint } });
      }
      setStatus("off");
    } catch (err) {
      setMessage(err instanceof Error && err.message ? err.message : "Notifications could not be turned off.");
      setStatus("error");
    }
  }, []);

  const dark = tone === "dark";
  const textCls = compact ? "text-xs" : "text-sm";
  const muted = dark ? "text-slate-400" : "text-slate-500";
  const body = dark ? "text-slate-300" : "text-slate-600";
  const good = dark ? "text-emerald-300" : "text-emerald-700";
  const wrap = compact ? "flex flex-wrap items-center justify-between gap-2" : "space-y-3";
  const primary = `inline-flex items-center gap-1.5 rounded-full bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white transition motion-reduce:transition-none hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS}`;
  const secondary = `inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-60 ${
    dark ? "border-slate-600 text-slate-200 hover:bg-slate-800" : "border-slate-300 text-slate-700 hover:bg-slate-100"
  } ${FOCUS}`;
  const working = status === "enabling" || status === "disabling";

  let content: React.ReactNode;
  if (capability === "server" || (status === "checking" && capability === "ready")) {
    content = <p data-testid={`push-toggle-${audience}-checking`} className={`${textCls} ${muted}`}>Checking notification support</p>;
  } else if (capability === "ios-install") {
    content = (
      <p data-testid={`push-toggle-${audience}-ios-install`} className={`${textCls} ${body}`}>
        On iPhone or iPad, add LinguaDesk to the Home Screen first, then turn on notifications here.
      </p>
    );
  } else if (capability === "unsupported") {
    content = (
      <p data-testid={`push-toggle-${audience}-unsupported`} className={`${textCls} ${body}`}>
        This browser does not support notifications on this device. You will still see new messages when you open LinguaDesk.
      </p>
    );
  } else if (status === "denied") {
    content = (
      <p data-testid={`push-toggle-${audience}-denied`} className={`${textCls} ${body}`}>
        Notifications are blocked for this site. Allow them in your browser settings, then reload.
      </p>
    );
  } else if (status === "on" || status === "disabling") {
    content = (
      <>
        <p data-testid={`push-toggle-${audience}-on`} className={`flex items-center gap-1.5 ${textCls} ${good}`}>
          <BellRing className="h-4 w-4 shrink-0" aria-hidden="true" /> Notifications are on for this device
        </p>
        <button type="button" onClick={() => void turnOff()} disabled={working} data-testid={`push-toggle-${audience}-off-btn`} className={secondary}>
          <BellOff className="h-3.5 w-3.5" aria-hidden="true" /> {status === "disabling" ? "Turning off" : "Turn off"}
        </button>
      </>
    );
  } else {
    content = (
      <>
        {!compact && (
          <p data-testid={`push-toggle-${audience}-hint`} className={`text-sm ${body}`}>
            {audience === "staff" ? "Get an alert on this device when a customer needs your team." : "Get an alert on this device when a shop replies or your order status changes."}
          </p>
        )}
        <button type="button" onClick={() => void turnOn()} disabled={working} data-testid={`push-toggle-${audience}-on-btn`} className={compact ? secondary : primary}>
          <Bell className="h-3.5 w-3.5" aria-hidden="true" /> {status === "enabling" ? "Turning on" : "Turn on notifications"}
        </button>
      </>
    );
  }

  const live = status === "error" ? message : working ? "Updating notification settings" : "";
  return (
    <div className={wrap} data-testid={`push-toggle-${audience}`}>
      {content}
      <p role="status" aria-live="polite" data-testid={`push-toggle-${audience}-status`} className={live ? `${textCls} w-full ${status === "error" ? (dark ? "text-red-300" : "text-red-700") : muted}` : "sr-only"}>
        {live}
      </p>
    </div>
  );
}
