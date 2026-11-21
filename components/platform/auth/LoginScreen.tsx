"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, LogIn, UserPlus } from "lucide-react";
import { deskPath, notifyAuthChanged, signOut, useCurrentStaff } from "@/components/platform/auth/session";
import { FormError, PasscodeField, PRIMARY_BUTTON, SECONDARY_BUTTON, TextField, FOCUS } from "@/components/platform/auth/fields";
import { LanguagePicker } from "@/components/platform/auth/LanguagePicker";
import { api } from "@/lib/v2/client";

type Tab = "signin" | "join";
type AuthResult = { ok: boolean; staff: { role: "owner" | "agent" } };

const TABS: { id: Tab; label: string }[] = [
  { id: "signin", label: "Sign in" },
  { id: "join", label: "Join a team" },
];

export default function LoginScreen({ initialTab = "signin" }: { initialTab?: Tab }) {
  const router = useRouter();
  const params = useSearchParams();
  const me = useCurrentStaff();
  const [tab, setTab] = useState<Tab>(initialTab);

  const [shop, setShop] = useState("");
  const [name, setName] = useState("");
  const [passcode, setPasscode] = useState("");
  const [inviteCode, setInviteCode] = useState(params.get("code") ?? "");
  const [joinName, setJoinName] = useState("");
  const [joinPasscode, setJoinPasscode] = useState("");
  const [languages, setLanguages] = useState<string[]>(["en"]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const result =
        tab === "signin"
          ? await api<AuthResult>("/api/auth/login", { method: "POST", json: { shop, name, passcode } })
          : await api<AuthResult>("/api/auth/join", { method: "POST", json: { inviteCode, name: joinName, passcode: joinPasscode, languages } });
      notifyAuthChanged();
      // The login screen stays mounted in the background after navigation, so leave it ready for the next sign-in.
      setPasscode("");
      setJoinPasscode("");
      setBusy(false);
      router.push(deskPath(result.staff.role));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in. Please try again.");
      setBusy(false);
    }
  }

  if (me === undefined) {
    return (
      <div className="mx-auto max-w-md px-4 py-16" role="status" aria-busy="true" data-testid="login-loading">
        <span className="sr-only">Loading</span>
        <div className="h-72 animate-pulse rounded-2xl bg-slate-100 motion-reduce:animate-none" />
      </div>
    );
  }

  if (me) {
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm" data-testid="login-signed-in">
          <h1 className="font-heading text-xl font-semibold text-slate-900">You are already signed in</h1>
          <p className="mt-2 text-sm text-slate-600" data-testid="login-signed-in-as">
            You are signed in as {me.name} of {me.sellerName}.
          </p>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link href={deskPath(me.role)} data-testid="login-open-desk" className={PRIMARY_BUTTON}>
              Open desk
            </Link>
            <button type="button" onClick={() => void signOut()} data-testid="login-sign-out" className={SECONDARY_BUTTON}>
              Sign out
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12 sm:py-16">
      <div className="text-center">
        <h1 className="font-heading text-3xl font-semibold tracking-tight text-slate-900">Welcome back</h1>
        <p className="mt-2 text-sm text-slate-600">Sign in to your shop, or join a team with the invite link from the shop owner.</p>
      </div>

      <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div role="tablist" aria-label="Account options" className="grid grid-cols-2 gap-1 rounded-full bg-slate-100 p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`login-tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls="login-panel"
              data-testid={`login-tab-${t.id}`}
              onClick={() => {
                setTab(t.id);
                setError("");
              }}
              className={`rounded-full px-3 py-2 text-sm font-semibold transition motion-reduce:transition-none ${FOCUS} ${
                tab === t.id ? "bg-white text-indigo-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <form onSubmit={submit} id="login-panel" role="tabpanel" aria-labelledby={`login-tab-${tab}`} className="mt-6 space-y-4" data-testid={`login-form-${tab}`}>
          {tab === "signin" ? (
            <>
              <TextField label="Shop name" testId="login-shop" value={shop} onChange={setShop} autoComplete="organization" disabled={busy} required />
              <TextField label="Your name" testId="login-name" value={name} onChange={setName} autoComplete="username" disabled={busy} required />
              <PasscodeField label="Passcode" testId="login-passcode" value={passcode} onChange={setPasscode} disabled={busy} />
            </>
          ) : (
            <>
              <TextField
                label="Invite code"
                testId="join-code"
                value={inviteCode}
                onChange={setInviteCode}
                hint="The shop owner creates an invite under Team in the seller studio and sends you the link or code. If you own the shop, use Sign in instead."
                disabled={busy}
                autoComplete="off"
                required
              />
              <TextField label="Your name" testId="join-name" value={joinName} onChange={setJoinName} autoComplete="username" disabled={busy} required />
              <PasscodeField
                label="Choose a passcode"
                testId="join-passcode"
                value={joinPasscode}
                onChange={setJoinPasscode}
                hint="At least 8 characters."
                autoComplete="new-password"
                disabled={busy}
              />
              <LanguagePicker value={languages} onChange={setLanguages} disabled={busy} idPrefix="join" />
            </>
          )}

          <FormError message={error} testId="login-error" />

          <button type="submit" disabled={busy} data-testid="login-submit" className={`${PRIMARY_BUTTON} w-full`}>
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
            ) : tab === "signin" ? (
              <LogIn className="h-4 w-4" aria-hidden="true" />
            ) : (
              <UserPlus className="h-4 w-4" aria-hidden="true" />
            )}
            {busy ? "Please wait" : tab === "signin" ? "Sign in" : "Join the team"}
          </button>
        </form>
        {tab === "signin" && (
          <p className="mt-4 text-center text-sm text-slate-600" data-testid="login-forgot">
            <Link href="/recover" data-testid="login-forgot-link" className={`font-medium text-indigo-600 underline underline-offset-2 hover:text-indigo-700 ${FOCUS}`}>
              Forgot your passcode?
            </Link>
            <span className="mt-1 block text-xs text-slate-500">Shop owners can reset it with their recovery code. Team members should ask the shop owner.</span>
          </p>
        )}
      </div>

      <p className="mt-6 text-center text-sm text-slate-600">
        New to LinguaDesk?{" "}
        <Link href="/sell" data-testid="login-open-shop" className={`font-medium text-indigo-600 underline underline-offset-2 hover:text-indigo-700 ${FOCUS}`}>
          Open your shop
        </Link>
      </p>
    </div>
  );
}
