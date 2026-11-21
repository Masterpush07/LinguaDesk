"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Mail } from "lucide-react";
import { usePrefs } from "@/components/platform/Prefs";
import { api } from "@/lib/v2/client";
import { FOCUS } from "./ChatParts";

type EmailStatus = { emailAvailable: boolean; email: { masked: string; verified: boolean } | null };

// The email half of "tell me when the shop replies". The browser popup beside it is the PushToggle.
export default function EmailNotify() {
  const { language } = usePrefs();
  const [status, setStatus] = useState<EmailStatus | null>(null);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; tone: "ok" | "error" } | null>(null);

  const load = useCallback(async () => {
    try {
      setStatus(await api<EmailStatus>("/api/buyer/notify"));
    } catch {
      // the form simply stays hidden if the status cannot be read
    }
  }, []);

  useEffect(() => {
    // Loads what this buyer already set up; the state is set once the server answers.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    setBusy(true);
    try {
      const res = await api<{ masked: string }>("/api/buyer/notify", { method: "POST", json: { email, language } });
      setEmail("");
      setMessage({ text: `We sent a confirmation to ${res.masked}. Open it and click the link to finish.`, tone: "ok" });
      await load();
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : "Could not send the confirmation.", tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await api("/api/buyer/notify", { method: "DELETE" });
      setMessage(null);
      await load();
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : "Could not remove the email.", tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  if (!status?.emailAvailable) return null;
  const confirmed = status.email?.verified === true;

  return (
    <div data-testid="email-notify" className="mx-auto mt-2 flex max-w-3xl flex-col gap-2">
      {status.email && (
        <p className="flex flex-wrap items-center gap-2 text-sm text-slate-700" data-testid="notify-email-on">
          <Mail className="h-4 w-4 text-slate-500" aria-hidden="true" />
          {status.email.masked} {confirmed ? "(confirmed)" : "(waiting for you to confirm)"}
          <button type="button" onClick={() => void remove()} disabled={busy} data-testid="notify-email-off" className={`text-indigo-700 underline disabled:opacity-60 ${FOCUS}`}>
            Remove
          </button>
        </p>
      )}
      {!confirmed && (
        <form onSubmit={submit} className="flex flex-wrap items-center gap-2" data-testid="notify-email-form">
          <label htmlFor="notify-email" className="sr-only">
            Email address
          </label>
          <input
            id="notify-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            maxLength={254}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={status.email ? "Use a different email" : "Or get an email when the shop replies"}
            data-testid="notify-email-input"
            className="min-w-0 flex-1 basis-56 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:border-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30"
          />
          <button
            type="submit"
            disabled={busy || !email.trim()}
            data-testid="notify-email-btn"
            className={`rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS}`}
          >
            {busy ? "Sending..." : "Email me"}
          </button>
        </form>
      )}
      {message && (
        <p role={message.tone === "error" ? "alert" : "status"} data-testid="notify-message" className={`text-sm ${message.tone === "error" ? "text-red-700" : "text-emerald-700"}`}>
          {message.text}
        </p>
      )}
    </div>
  );
}
