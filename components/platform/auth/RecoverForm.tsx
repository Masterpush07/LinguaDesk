"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { CheckCircle2, Copy, KeyRound, Loader2 } from "lucide-react";
import { notifyAuthChanged } from "@/components/platform/auth/session";
import { FormError, FOCUS, PasscodeField, PRIMARY_BUTTON, SECONDARY_BUTTON, TextField } from "@/components/platform/auth/fields";
import { api } from "@/lib/v2/client";

type Recovered = { ok: boolean; recoveryCode: string; seller: { slug: string; name: string } };

export default function RecoverForm() {
  const [shop, setShop] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [passcode, setPasscode] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Recovered | null>(null);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState<"" | "yes" | "failed">("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!shop.trim() || !name.trim() || !code.trim()) return setError("Enter the shop name, your name and your recovery code.");
    if (passcode.length < 8) return setError("Choose a new passcode of at least 8 characters.");
    if (passcode !== confirm) return setError("The new passcode and its confirmation do not match.");
    setBusy(true);
    setError("");
    try {
      const result = await api<Recovered>("/api/auth/recover", { method: "POST", json: { shop, name, recoveryCode: code, newPasscode: passcode } });
      notifyAuthChanged();
      setPasscode("");
      setConfirm("");
      setCode("");
      setDone(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reset the passcode. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!done) return;
    try {
      await navigator.clipboard.writeText(done.recoveryCode);
      setCopied("yes");
    } catch {
      setCopied("failed");
    }
    setTimeout(() => setCopied(""), 2500);
  }

  if (done) {
    return (
      <div className="mx-auto max-w-md px-4 py-12 sm:py-16" data-testid="recover-success">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="flex items-center gap-2 text-sm font-medium text-emerald-700" role="status">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            Your passcode was changed and you are signed in to {done.seller.name}.
          </p>
          <h1 className="mt-3 font-heading text-xl font-semibold text-slate-900">Your new recovery code</h1>
          <p className="mt-1 text-sm text-slate-700" data-testid="recover-code-warning">
            Your previous recovery code no longer works. This code is the only way to reset your passcode. It is shown once. Store it somewhere safe.
          </p>
          <p className="mt-4 select-all break-all rounded-lg bg-amber-50 px-3 py-3 text-center font-mono text-lg font-semibold tracking-widest text-slate-900 ring-1 ring-amber-200" data-testid="recover-new-code">
            {done.recoveryCode}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button type="button" onClick={copy} data-testid="recover-copy" className={SECONDARY_BUTTON}>
              <Copy className="h-4 w-4" aria-hidden="true" />
              Copy code
            </button>
            <span role="status" aria-live="polite" data-testid="recover-copy-status" className="text-xs font-medium text-slate-700">
              {copied === "yes" ? "Copied to the clipboard." : copied === "failed" ? "Copying failed. Select the code and copy it manually." : ""}
            </span>
          </div>
          <label className="mt-5 flex items-start gap-2 text-sm text-slate-800">
            <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} data-testid="recover-saved" className="mt-0.5 h-4 w-4 rounded border-slate-400" />
            I have saved my new recovery code
          </label>
          {saved ? (
            <Link href="/seller" data-testid="recover-open-studio" className={`${PRIMARY_BUTTON} mt-5 w-full`}>
              Open seller studio
            </Link>
          ) : (
            <span aria-disabled="true" data-testid="recover-open-studio-disabled" className="mt-5 inline-flex w-full cursor-not-allowed items-center justify-center rounded-full bg-indigo-300 px-5 py-2.5 text-sm font-semibold text-white">
              Open seller studio
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12 sm:py-16">
      <div className="text-center">
        <h1 className="font-heading text-3xl font-semibold tracking-tight text-slate-900">Reset your passcode</h1>
        <p className="mt-2 text-sm text-slate-600">Shop owners can set a new passcode with the recovery code that was shown when the shop was created. Team members should ask the shop owner for help.</p>
      </div>

      <form onSubmit={submit} noValidate className="mt-8 space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" data-testid="recover-form">
        <TextField label="Shop name" testId="recover-shop" value={shop} onChange={setShop} autoComplete="organization" disabled={busy} required />
        <TextField label="Your name" testId="recover-name" value={name} onChange={setName} autoComplete="username" disabled={busy} required />
        <TextField label="Recovery code" testId="recover-code" value={code} onChange={setCode} hint="For example ABCD-EFGH-JKMN. Dashes and capital letters are optional." autoComplete="off" disabled={busy} required />
        <PasscodeField label="New passcode" testId="recover-passcode" value={passcode} onChange={setPasscode} hint="At least 8 characters." autoComplete="new-password" disabled={busy} />
        <PasscodeField label="Confirm new passcode" testId="recover-passcode-confirm" value={confirm} onChange={setConfirm} autoComplete="new-password" disabled={busy} />
        <FormError message={error} testId="recover-error" />
        <button type="submit" disabled={busy} data-testid="recover-submit" className={`${PRIMARY_BUTTON} w-full`}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <KeyRound className="h-4 w-4" aria-hidden="true" />}
          {busy ? "Please wait" : "Reset passcode"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-600">
        Remembered it?{" "}
        <Link href="/login" data-testid="recover-back-to-login" className={`font-medium text-indigo-600 underline underline-offset-2 hover:text-indigo-700 ${FOCUS}`}>
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
