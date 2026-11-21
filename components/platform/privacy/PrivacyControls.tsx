"use client";

import { useState } from "react";
import { Download, Trash2 } from "lucide-react";
import { api, ApiError } from "@/lib/v2/client";
import type { DeletionSummary } from "@/lib/v2/buyer-privacy";

const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

// The two buyer controls: a copy of their data, and deletion. No sign-in exists, so both act on the guest identity of this browser.
export default function PrivacyControls() {
  const [busy, setBusy] = useState<"download" | "delete" | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState("");
  const [done, setDone] = useState<DeletionSummary | null>(null);

  async function download() {
    setBusy("download");
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/buyer/data", { cache: "no-store" });
      if (res.status === 401) throw new Error("There is no data for this browser yet. Start a conversation with a shop first.");
      if (!res.ok) throw new Error(((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? "Your data could not be prepared.");
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = "my-linguadesk-data.json";
      a.click();
      URL.revokeObjectURL(url);
      setMessage("Your data was downloaded as my-linguadesk-data.json.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Your data could not be prepared.");
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    setBusy("delete");
    setError("");
    try {
      const result = await api<{ ok: boolean; summary: DeletionSummary }>("/api/buyer/data", { method: "DELETE", json: { confirm: true } });
      try {
        localStorage.removeItem("linguadesk.delivery");
      } catch {
        // Storage can be blocked; the server side is already deleted.
      }
      setDone(result.summary);
      setConfirming(false);
    } catch (err) {
      setError(err instanceof ApiError && err.status === 401 ? "There is no data for this browser to delete." : err instanceof Error ? err.message : "Your data could not be deleted.");
    } finally {
      setBusy(null);
    }
  }

  if (done) {
    return (
      <div role="status" data-testid="privacy-deleted" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900">
        <p className="font-semibold">Your data was deleted.</p>
        <ul className="mt-2 list-disc space-y-0.5 pl-5">
          <li>{plural(done.conversations, "conversation", "conversations")} with {plural(done.messages, "message", "messages")}</li>
          <li>{plural(done.photos, "photo", "photos")}</li>
          <li>{plural(done.addresses, "delivery address", "delivery addresses")}</li>
          <li>{plural(done.reviews, "review text", "review texts")} and the details of {plural(done.returns, "return request", "return requests")}</li>
          <li>{done.email ? "Your alert email address" : "No alert email address was saved"}, and {plural(done.devices, "browser with alerts", "browsers with alerts")}</li>
        </ul>
        <p className="mt-3">This browser is no longer linked to those orders. If you open a shop chat again, you start fresh.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="privacy-controls">
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-heading text-base font-semibold text-slate-900">Get a copy of your data</h3>
          <p className="mt-0.5 text-sm text-slate-600">Your conversations, orders, addresses, returns and reviews as one file.</p>
        </div>
        <button type="button" onClick={() => void download()} disabled={busy !== null} data-testid="privacy-download" className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60 ${FOCUS}`}>
          <Download className="h-4 w-4" aria-hidden="true" />
          {busy === "download" ? "Preparing..." : "Download my data"}
        </button>
      </div>

      <div className="rounded-2xl border border-red-200 bg-white p-5">
        <h3 className="font-heading text-base font-semibold text-slate-900">Delete my data</h3>
        <p className="mt-0.5 text-sm text-slate-600">Removes your conversations and messages, photos, delivery addresses, review and return text, alert email and push alerts. This cannot be undone.</p>
        {!confirming ? (
          <button type="button" onClick={() => setConfirming(true)} data-testid="privacy-delete-start" className={`mt-3 inline-flex items-center gap-2 rounded-full border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 ${FOCUS}`}>
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Delete my data...
          </button>
        ) : (
          <div className="mt-3 rounded-xl bg-red-50 p-4 text-sm text-red-900" data-testid="privacy-delete-confirm">
            <p className="font-semibold">Before you continue</p>
            <p className="mt-1">The shops you ordered from keep a record of each order (items, total and status) without your name, address or messages, because they need it for their own books.</p>
            <label htmlFor="privacy-confirm-input" className="mt-3 block font-medium">
              Type DELETE to confirm
            </label>
            <input id="privacy-confirm-input" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" data-testid="privacy-confirm-input" className={`mt-1 w-full max-w-xs rounded-lg border border-red-300 bg-white px-3 py-2 text-slate-900 ${FOCUS}`} />
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={() => void remove()} disabled={typed !== "DELETE" || busy !== null} data-testid="privacy-delete-confirm-btn" className={`rounded-full bg-red-600 px-4 py-2 font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-300 ${FOCUS}`}>
                {busy === "delete" ? "Deleting..." : "Delete everything"}
              </button>
              <button type="button" onClick={() => { setConfirming(false); setTyped(""); }} disabled={busy !== null} className={`rounded-full border border-slate-300 bg-white px-4 py-2 font-medium text-slate-700 hover:bg-slate-50 ${FOCUS}`}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {message && (
        <p role="status" data-testid="privacy-message" className="text-sm text-emerald-700">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" data-testid="privacy-error" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 ring-1 ring-red-200">
          {error}
        </p>
      )}
    </div>
  );
}
