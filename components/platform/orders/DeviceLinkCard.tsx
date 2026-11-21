"use client";

import { useState } from "react";
import QRCode from "qrcode";
import { AlertTriangle, Check, Copy, Link2, Smartphone } from "lucide-react";
import { api, ApiError } from "@/lib/v2/client";

const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2";

type Created = { url: string; expiresAt: string; qr: string };

// Conversations are tied to this browser. A one-time link signs another device in to the same conversations.
export default function DeviceLinkCard() {
  const [created, setCreated] = useState<Created | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<"" | "yes" | "failed">("");

  async function create() {
    setBusy(true);
    setError("");
    setCopied("");
    try {
      const { url, expiresAt } = await api<{ url: string; expiresAt: string }>("/api/buyer/device-link", { method: "POST" });
      const qr = await QRCode.toDataURL(url, { margin: 1, width: 220, errorCorrectionLevel: "M" });
      setCreated({ url, expiresAt, qr });
    } catch (err) {
      setCreated(null);
      setError(
        err instanceof ApiError && err.status === 401
          ? "Start a conversation with a shop first. Then you can create a link to continue it on another device."
          : err instanceof Error
            ? err.message
            : "The link could not be created. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.url);
      setCopied("yes");
    } catch {
      setCopied("failed");
    }
  }

  return (
    <div data-testid="profile-device-link">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
        <Smartphone className="h-4 w-4 text-indigo-600" aria-hidden="true" /> Use on another device
      </h3>
      <p className="mt-1 text-sm text-slate-600">Create a link, then open it on your other device or scan the code. Your conversations and orders appear there too.</p>
      <button
        type="button"
        onClick={() => void create()}
        disabled={busy}
        data-testid="profile-device-link-create-btn"
        className={`mt-3 inline-flex items-center gap-1.5 rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition motion-reduce:transition-none hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS}`}
      >
        <Link2 className="h-4 w-4" aria-hidden="true" /> {busy ? "Creating link" : created ? "Create a new link" : "Create a link"}
      </button>

      <p role="alert" data-testid="profile-device-link-error" className={error ? "mt-3 text-sm text-red-700" : "sr-only"}>
        {error}
      </p>

      {created && (
        <div data-testid="profile-device-link-result" className="mt-4 flex flex-col gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-start">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={created.qr} alt="QR code that opens your conversations on another device" width={140} height={140} data-testid="profile-device-link-qr" className="h-36 w-36 shrink-0 rounded-lg border border-slate-200 bg-white p-1" />
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={created.url}
                aria-label="One-time link"
                data-testid="profile-device-link-url"
                onFocus={(e) => e.currentTarget.select()}
                className={`min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 ${FOCUS}`}
              />
              <button
                type="button"
                onClick={() => void copy()}
                data-testid="profile-device-link-copy-btn"
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 ${FOCUS}`}
              >
                {copied === "yes" ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />} {copied === "yes" ? "Copied" : "Copy"}
              </button>
            </div>
            <p role="status" aria-live="polite" data-testid="profile-device-link-copy-status" className={copied === "failed" ? "text-xs text-slate-600" : "sr-only"}>
              {copied === "failed" ? "The link could not be copied. Select it and copy it manually." : copied === "yes" ? "Link copied" : ""}
            </p>
            <p data-testid="profile-device-link-expiry" className="text-xs text-slate-600">
              This link works once and expires at {new Date(created.expiresAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.
            </p>
            <p data-testid="profile-device-link-warning" className="flex items-start gap-1.5 text-xs font-medium text-amber-800">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" /> Anyone with this link can open your conversations until it expires or is used.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
