"use client";

import { useId, useState } from "react";
import { Bell, CheckCircle2, Globe2, Lock, MessageSquareText } from "lucide-react";
import { usePrefs } from "@/components/platform/Prefs";
import PushToggle from "@/components/platform/PushToggle";
import DeviceLinkCard from "@/components/platform/orders/DeviceLinkCard";
import { CURRENCIES as CURRENCY_LIST, LANGS } from "@/lib/platform/data";
import type { Currency, LangCode } from "@/lib/platform/types";

const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2";
const CARD = "rounded-2xl border border-slate-200 bg-white p-6";
const FIELD = `mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 ${FOCUS}`;
const CURRENCIES = CURRENCY_LIST.map((c) => ({ code: c.code, label: `${c.label} (${c.code})` }));

export default function ProfileForm() {
  const { language, setLanguage, currency, setCurrency } = usePrefs();
  const uid = useId();
  const [saved, setSaved] = useState("");

  return (
    <div className="space-y-6">
      <section aria-labelledby={`${uid}-prefs`} className={CARD} data-testid="profile-preferences">
        <h2 id={`${uid}-prefs`} className="flex items-center gap-2 font-heading text-lg font-semibold text-slate-900">
          <Globe2 className="h-5 w-5 text-indigo-600" aria-hidden="true" /> Language and currency
        </h2>
        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor={`${uid}-language`} className="text-sm font-medium text-slate-800">
              Your language
            </label>
            <select
              id={`${uid}-language`}
              data-testid="profile-language-select"
              value={language}
              onChange={(e) => {
                setLanguage(e.target.value as LangCode);
                setSaved("Language saved on this device.");
              }}
              className={FIELD}
            >
              {Object.values(LANGS).map((l) => (
                <option key={l.code} value={l.code}>
                  {l.name} ({l.native})
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-xs text-slate-500">Used for suggested questions and voice messages. You can write to any shop in any language.</p>
          </div>
          <div>
            <label htmlFor={`${uid}-currency`} className="text-sm font-medium text-slate-800">
              Currency
            </label>
            <select
              id={`${uid}-currency`}
              data-testid="profile-currency-select"
              value={currency}
              onChange={(e) => {
                setCurrency(e.target.value as Currency);
                setSaved("Currency saved on this device.");
              }}
              className={FIELD}
            >
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-xs text-slate-500">Product prices are converted from US dollars for browsing. Orders and totals are always in US dollars.</p>
          </div>
        </div>
        <p role="status" aria-live="polite" data-testid="profile-saved" className="mt-4 flex min-h-5 items-center gap-1.5 text-sm text-emerald-700">
          {saved && (
            <>
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> {saved}
            </>
          )}
        </p>
      </section>

      <section aria-labelledby={`${uid}-keep`} className={CARD} data-testid="profile-keep-conversations">
        <h2 id={`${uid}-keep`} className="flex items-center gap-2 font-heading text-lg font-semibold text-slate-900">
          <MessageSquareText className="h-5 w-5 text-indigo-600" aria-hidden="true" /> Keep your conversations
        </h2>
        <p className="mt-3 text-sm text-slate-600">
          Your conversations and orders are tied to this device and browser. To continue them somewhere else, create a one-time link and open it on your other device.
        </p>
        <div className="mt-5 border-t border-slate-100 pt-5">
          <DeviceLinkCard />
        </div>
      </section>

      <section aria-labelledby={`${uid}-alerts`} className={CARD} data-testid="profile-alerts">
        <h2 id={`${uid}-alerts`} className="flex items-center gap-2 font-heading text-lg font-semibold text-slate-900">
          <Bell className="h-5 w-5 text-indigo-600" aria-hidden="true" /> Alerts
        </h2>
        <div className="mt-3">
          <PushToggle audience="buyer" />
        </div>
      </section>

      <section aria-labelledby={`${uid}-privacy`} className={CARD} data-testid="profile-privacy">
        <h2 id={`${uid}-privacy`} className="flex items-center gap-2 font-heading text-lg font-semibold text-slate-900">
          <Lock className="h-5 w-5 text-indigo-600" aria-hidden="true" /> Privacy
        </h2>
        <p className="mt-3 text-sm text-slate-600">
          You do not need an account to shop. When you message a shop, an anonymous visitor identity is stored in a cookie in this browser so your conversations and orders stay linked to you. Your messages are
          stored so the shop team and the AI assistant can answer you, and they are translated automatically. Your language and currency choices are saved only on this device. If you clear this browser&apos;s
          cookies, you will no longer see your earlier conversations.
        </p>
      </section>
    </div>
  );
}
