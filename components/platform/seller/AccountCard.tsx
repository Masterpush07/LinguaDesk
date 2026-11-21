"use client";

import { useState, type FormEvent } from "react";
import { KeyRound, ShieldCheck } from "lucide-react";
import { BTN_GHOST, BTN_PRIMARY, Card, CopyButton, ErrorBlock, FieldError, INPUT, Label, LoadingBlock, Notice } from "@/components/platform/seller/ui";
import { api } from "@/lib/v2/client";
import { errorMessage, useApi } from "@/lib/v2/seller-hooks";

const MIN_LENGTH = 8;

function ChangePasscodeForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setNotice("");
    if (!current) return setError("Enter your current passcode.");
    if (next.length < MIN_LENGTH) return setError(`Choose a new passcode of at least ${MIN_LENGTH} characters.`);
    if (next === current) return setError("The new passcode must be different from the current passcode.");
    if (next !== confirm) return setError("The new passcode and its confirmation do not match.");
    setError("");
    setBusy(true);
    try {
      await api("/api/auth/change-passcode", { method: "POST", json: { current, next } });
      setCurrent("");
      setNext("");
      setConfirm("");
      setNotice("Your passcode was changed. Use the new passcode the next time you sign in.");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-3" data-testid="account-passcode-form">
      <h3 className="text-sm font-semibold text-slate-900">Change passcode</h3>
      <div>
        <Label htmlFor="account-current-passcode">Current passcode</Label>
        <input id="account-current-passcode" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} disabled={busy} data-testid="account-current-passcode" className={INPUT} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="account-new-passcode" hint={`At least ${MIN_LENGTH} characters.`}>New passcode</Label>
          <input id="account-new-passcode" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} disabled={busy} data-testid="account-new-passcode" className={INPUT} />
        </div>
        <div>
          <Label htmlFor="account-confirm-passcode">Confirm new passcode</Label>
          <input id="account-confirm-passcode" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} disabled={busy} data-testid="account-confirm-passcode" className={INPUT} />
        </div>
      </div>
      <FieldError id="account-passcode-error" message={error} testId="account-passcode-error" />
      <Notice message={notice} testId="account-passcode-confirmation" />
      <button type="submit" disabled={busy} data-testid="account-passcode-submit" className={BTN_PRIMARY}>
        {busy ? "Saving" : "Change passcode"}
      </button>
    </form>
  );
}

function RecoveryCodeSection() {
  const { data, error, loading, reload, update } = useApi<{ set: boolean }>("/api/auth/recovery-code");
  const [open, setOpen] = useState(false);
  const [passcode, setPasscode] = useState("");
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState("");
  const [hadCode, setHadCode] = useState(false);

  const start = () => {
    setHadCode(data?.set === true);
    setOpen(true);
    setPasscode("");
    setFormError("");
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!passcode) return setFormError("Enter your current passcode.");
    setFormError("");
    setBusy(true);
    try {
      const res = await api<{ recoveryCode: string }>("/api/auth/recovery-code", { method: "POST", json: { passcode } });
      setCode(res.recoveryCode);
      setPasscode("");
      setOpen(false);
      update(() => ({ set: true }));
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3" data-testid="account-recovery">
      <h3 className="text-sm font-semibold text-slate-900">Recovery code</h3>
      <p className="text-sm text-slate-600">If you forget your passcode, the recovery code lets you set a new one on the Forgot your passcode page. We store only a scrambled copy, so we cannot show it again.</p>
      {loading && <LoadingBlock label="Checking your recovery code" testId="account-recovery-loading" rows={1} />}
      {error && !data && <ErrorBlock message={error} onRetry={reload} testId="account-recovery-error" />}
      {data && (
        <p data-testid="account-recovery-state" className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-sm font-medium ring-1 ${data.set ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-amber-50 text-amber-800 ring-amber-200"}`}>
          <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          {data.set ? "A recovery code is set" : "No recovery code yet"}
        </p>
      )}

      {code && (
        <div role="status" className="rounded-xl border border-amber-300 bg-amber-50 p-4" data-testid="account-recovery-result">
          <p className="text-sm font-semibold text-amber-900">Your new recovery code</p>
          <p className="mt-1 text-sm text-amber-900">
            {hadCode ? "Your previous recovery code no longer works. " : ""}This code is shown once. Store it somewhere safe.
          </p>
          <p className="mt-3 select-all break-all rounded-lg bg-white px-3 py-2 text-center font-mono text-lg font-semibold tracking-widest text-slate-900 ring-1 ring-amber-200" data-testid="account-recovery-code">{code}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <CopyButton text={code} label="Copy code" testId="account-recovery-copy" />
            <button type="button" onClick={() => setCode("")} data-testid="account-recovery-done" className={BTN_GHOST}>I have saved it</button>
          </div>
        </div>
      )}

      {data && !open && (
        <button type="button" onClick={start} data-testid="account-recovery-create" className={BTN_GHOST}>
          <KeyRound className="h-4 w-4" aria-hidden="true" />
          Create a new recovery code
        </button>
      )}
      {open && (
        <form onSubmit={submit} noValidate className="space-y-3 rounded-xl border border-slate-200 p-4" data-testid="account-recovery-form">
          {hadCode && <p className="text-sm text-slate-700">Creating a new code makes the current recovery code stop working.</p>}
          <div>
            <Label htmlFor="account-recovery-passcode">Current passcode</Label>
            <input id="account-recovery-passcode" type="password" autoComplete="current-password" value={passcode} onChange={(e) => setPasscode(e.target.value)} disabled={busy} data-testid="account-recovery-passcode" className={INPUT} />
          </div>
          <FieldError id="account-recovery-form-error" message={formError} testId="account-recovery-form-error" />
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={busy} data-testid="account-recovery-confirm" className={BTN_PRIMARY}>{busy ? "Creating" : "Create code"}</button>
            <button type="button" onClick={() => setOpen(false)} disabled={busy} data-testid="account-recovery-cancel" className={BTN_GHOST}>Cancel</button>
          </div>
        </form>
      )}
    </div>
  );
}

export default function AccountCard() {
  return (
    <Card testId="account-card" className="mt-6">
      <h2 className="font-heading text-lg font-semibold text-slate-900">Account security</h2>
      <p className="mt-1 text-sm text-slate-600">Manage the passcode you use to sign in and the recovery code that protects your shop.</p>
      <div className="mt-5 space-y-8">
        <ChangePasscodeForm />
        <hr className="border-slate-200" />
        <RecoveryCodeSection />
      </div>
    </Card>
  );
}
