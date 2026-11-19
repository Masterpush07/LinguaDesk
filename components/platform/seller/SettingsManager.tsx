"use client";

import { useState, useSyncExternalStore } from "react";
import { ExternalLink, LogOut, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { LanguagePicker } from "@/components/platform/seller/LanguagePicker";
import { BTN_GHOST, BTN_PRIMARY, Card, CopyButton, ErrorBlock, FieldError, FOCUS, INPUT, Label, LoadingBlock, Notice } from "@/components/platform/seller/ui";
import { NextAction } from "@/components/platform/ui";
import { api } from "@/lib/v2/client";
import { errorMessage, useApi } from "@/lib/v2/seller-hooks";
import { settingsPayload, type SettingsDto } from "@/lib/v2/seller-types";

const POLICIES = [
  ["returns", "Returns and refunds"],
  ["payment", "Payment"],
  ["customOrders", "Custom orders"],
  ["discounts", "Discounts and bargaining"],
  ["giftWrap", "Gift wrapping"],
  ["care", "Care instructions"],
] as const;

type Form = {
  name: string;
  tagline: string;
  about: string;
  country: string;
  hours: string;
  languages: string[];
  responseTargetMin: string;
  freeAbove: string;
  fee: string;
  worldwideDays: string;
  domesticDays: string;
  shippingNotes: string;
  policies: SettingsDto["policies"];
};

const toForm = (s: SettingsDto): Form => ({
  name: s.name,
  tagline: s.tagline,
  about: s.about,
  country: s.country,
  hours: s.hours,
  languages: s.languages,
  responseTargetMin: String(s.responseTargetMin),
  freeAbove: String(s.shipping.freeAbove),
  fee: String(s.shipping.fee),
  worldwideDays: s.shipping.worldwideDays,
  domesticDays: s.shipping.domesticDays,
  shippingNotes: s.shipping.notes,
  policies: s.policies,
});

const WHOLE = /^\d+$/;
const whole = (v: string, min: number, max: number) => WHOLE.test(v.trim()) && Number(v) >= min && Number(v) <= max;

function validate(f: Form): Record<string, string> {
  const e: Record<string, string> = {};
  if (!f.name.trim()) e.name = "Enter your shop name.";
  else if (f.name.trim().length > 60) e.name = "The shop name must be at most 60 characters.";
  if (f.tagline.length > 200) e.tagline = "The tagline must be at most 200 characters.";
  if (f.about.length > 600) e.about = "The description must be at most 600 characters.";
  if (f.country.length > 100) e.country = "The country must be at most 100 characters.";
  if (f.hours.length > 120) e.hours = "The support hours must be at most 120 characters.";
  if (!whole(f.responseTargetMin, 1, 1440)) e.responseTargetMin = "Enter the response target as whole minutes from 1 to 1440.";
  if (!whole(f.freeAbove, 0, 100000)) e.freeAbove = "Enter a whole number of dollars from 0 to 100000. Use 0 for no free-shipping threshold.";
  if (!whole(f.fee, 0, 1000)) e.fee = "Enter a whole number of dollars from 0 to 1000. Use 0 for free shipping.";
  if (f.worldwideDays.length > 60) e.worldwideDays = "At most 60 characters.";
  if (f.domesticDays.length > 60) e.domesticDays = "At most 60 characters.";
  if (f.shippingNotes.length > 400) e.shippingNotes = "The shipping notes must be at most 400 characters.";
  for (const [key, label] of POLICIES) if (f.policies[key].length > 500) e[key] = `${label} must be at most 500 characters.`;
  return e;
}

const originStore = { subscribe: () => () => {}, client: () => window.location.origin, server: () => "" };

function SettingsForm({ initial }: { initial: SettingsDto }) {
  const router = useRouter();
  const origin = useSyncExternalStore(originStore.subscribe, originStore.client, originStore.server);
  const [saved, setSaved] = useState(initial);
  const [form, setForm] = useState<Form>(() => toForm(initial));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [saveError, setSaveError] = useState("");
  const [signOutError, setSignOutError] = useState("");

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));
  const cls = (key: string) => `${INPUT} ${errors[key] ? "border-red-400" : ""}`;
  const dirty = JSON.stringify(form) !== JSON.stringify(toForm(saved));
  const shareUrl = `${origin}${saved.shareUrlPath}`;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const found = validate(form);
    setErrors(found);
    setNotice("");
    setSaveError("");
    if (Object.keys(found).length > 0) return setSaveError("Some fields need attention. Fix the highlighted fields and save again.");
    setSaving(true);
    try {
      const result = await api<SettingsDto>("/api/desk/settings", {
        method: "PUT",
        json: {
          ...settingsPayload(saved),
          name: form.name.trim(),
          tagline: form.tagline.trim(),
          about: form.about.trim(),
          country: form.country.trim(),
          hours: form.hours.trim(),
          languages: form.languages,
          responseTargetMin: Number(form.responseTargetMin),
          shipping: {
            freeAbove: Number(form.freeAbove),
            fee: Number(form.fee),
            worldwideDays: form.worldwideDays.trim(),
            domesticDays: form.domesticDays.trim(),
            notes: form.shippingNotes.trim(),
          },
          policies: Object.fromEntries(POLICIES.map(([k]) => [k, form.policies[k].trim()])),
        },
      });
      setSaved(result);
      setForm(toForm(result));
      setNotice("Settings saved. The AI and your storefront use the new details immediately.");
    } catch (err) {
      setSaveError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const signOut = async () => {
    setSignOutError("");
    try {
      await api("/api/auth/logout", { method: "POST" });
      router.push("/login");
    } catch (err) {
      setSignOutError(errorMessage(err));
    }
  };

  const counter = (value: string, max: number, id: string) => (
    <p id={id} className={`mt-1 text-right text-xs ${value.length > max ? "font-semibold text-red-600" : "text-slate-500"}`}>{value.length} / {max}</p>
  );

  return (
    <form onSubmit={submit} noValidate className="space-y-6">
      <Card testId="settings-profile">
        <h2 className="font-heading text-lg font-semibold text-slate-900">Shop profile</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="st-name" hint="Your storefront address does not change when you rename the shop.">Shop name</Label>
            <input id="st-name" value={form.name} onChange={(e) => set("name", e.target.value)} aria-describedby="st-name-error" aria-invalid={!!errors.name} data-testid="settings-name-input" className={cls("name")} />
            <FieldError id="st-name-error" message={errors.name} testId="settings-name-error" />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="st-tagline" hint="One line shown under your shop name.">Tagline</Label>
            <input id="st-tagline" value={form.tagline} onChange={(e) => set("tagline", e.target.value)} aria-describedby="st-tagline-error" aria-invalid={!!errors.tagline} data-testid="settings-tagline-input" className={cls("tagline")} />
            <FieldError id="st-tagline-error" message={errors.tagline} testId="settings-tagline-error" />
            {counter(form.tagline, 200, "st-tagline-count")}
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="st-about" hint="Your story. The AI can use it to answer questions about the shop.">About the shop</Label>
            <textarea id="st-about" rows={4} value={form.about} onChange={(e) => set("about", e.target.value)} aria-describedby="st-about-error" aria-invalid={!!errors.about} data-testid="settings-about-input" className={cls("about")} />
            <FieldError id="st-about-error" message={errors.about} testId="settings-about-error" />
            {counter(form.about, 600, "st-about-count")}
          </div>
          <div>
            <Label htmlFor="st-country">Country</Label>
            <input id="st-country" value={form.country} onChange={(e) => set("country", e.target.value)} aria-describedby="st-country-error" aria-invalid={!!errors.country} data-testid="settings-country-input" className={cls("country")} />
            <FieldError id="st-country-error" message={errors.country} testId="settings-country-error" />
          </div>
          <div>
            <Label htmlFor="st-hours" hint="When agents are available, for example Mon to Fri, 09:00 to 18:00 IST.">Support hours</Label>
            <input id="st-hours" value={form.hours} onChange={(e) => set("hours", e.target.value)} aria-describedby="st-hours-error" aria-invalid={!!errors.hours} data-testid="settings-hours-input" className={cls("hours")} />
            <FieldError id="st-hours-error" message={errors.hours} testId="settings-hours-error" />
          </div>
        </div>
      </Card>

      <Card testId="settings-languages">
        <h2 className="font-heading text-lg font-semibold text-slate-900">Languages</h2>
        <p className="mt-0.5 mb-3 text-sm text-slate-500">Languages your shop serves. English is always included because your team works in English.</p>
        <LanguagePicker value={form.languages} onChange={(next) => set("languages", next)} idPrefix="settings" locked={["en"]} label="Shop languages" />
      </Card>

      <Card testId="settings-response">
        <h2 className="font-heading text-lg font-semibold text-slate-900">Response target</h2>
        <p className="mt-0.5 text-sm text-slate-500">How many minutes a customer waits for an agent before the conversation counts as overdue.</p>
        <div className="mt-3 max-w-48">
          <Label htmlFor="st-target">Minutes</Label>
          <input id="st-target" inputMode="numeric" value={form.responseTargetMin} onChange={(e) => set("responseTargetMin", e.target.value)} aria-describedby="st-target-error" aria-invalid={!!errors.responseTargetMin} data-testid="settings-target-input" className={cls("responseTargetMin")} />
        </div>
        <FieldError id="st-target-error" message={errors.responseTargetMin} testId="settings-target-error" />
      </Card>

      <Card testId="settings-shipping">
        <h2 className="font-heading text-lg font-semibold text-slate-900">Shipping</h2>
        <p className="mt-0.5 text-sm text-slate-500">Used to price orders and to answer shipping questions. Amounts are in US dollars.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="st-fee" hint="Flat fee per order. 0 means free shipping.">Shipping fee</Label>
            <input id="st-fee" inputMode="numeric" value={form.fee} onChange={(e) => set("fee", e.target.value)} aria-describedby="st-fee-error" aria-invalid={!!errors.fee} data-testid="settings-fee-input" className={cls("fee")} />
            <FieldError id="st-fee-error" message={errors.fee} testId="settings-fee-error" />
          </div>
          <div>
            <Label htmlFor="st-free" hint="Orders above this amount ship free. 0 means no threshold.">Free shipping above</Label>
            <input id="st-free" inputMode="numeric" value={form.freeAbove} onChange={(e) => set("freeAbove", e.target.value)} aria-describedby="st-free-error" aria-invalid={!!errors.freeAbove} data-testid="settings-free-above-input" className={cls("freeAbove")} />
            <FieldError id="st-free-error" message={errors.freeAbove} testId="settings-free-above-error" />
          </div>
          <div>
            <Label htmlFor="st-world">Worldwide delivery time</Label>
            <input id="st-world" value={form.worldwideDays} onChange={(e) => set("worldwideDays", e.target.value)} aria-describedby="st-world-error" aria-invalid={!!errors.worldwideDays} data-testid="settings-worldwide-input" className={cls("worldwideDays")} placeholder="7 to 14 days" />
            <FieldError id="st-world-error" message={errors.worldwideDays} testId="settings-worldwide-error" />
          </div>
          <div>
            <Label htmlFor="st-domestic">Home-country delivery time</Label>
            <input id="st-domestic" value={form.domesticDays} onChange={(e) => set("domesticDays", e.target.value)} aria-describedby="st-domestic-error" aria-invalid={!!errors.domesticDays} data-testid="settings-domestic-input" className={cls("domesticDays")} placeholder="3 to 5 days" />
            <FieldError id="st-domestic-error" message={errors.domesticDays} testId="settings-domestic-error" />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="st-ship-notes">Shipping notes</Label>
            <textarea id="st-ship-notes" rows={2} value={form.shippingNotes} onChange={(e) => set("shippingNotes", e.target.value)} aria-describedby="st-ship-notes-error" aria-invalid={!!errors.shippingNotes} data-testid="settings-shipping-notes-input" className={cls("shippingNotes")} />
            <FieldError id="st-ship-notes-error" message={errors.shippingNotes} testId="settings-shipping-notes-error" />
            {counter(form.shippingNotes, 400, "st-ship-notes-count")}
          </div>
        </div>
      </Card>

      <Card testId="settings-policies">
        <h2 className="font-heading text-lg font-semibold text-slate-900">Policies</h2>
        <p className="mt-0.5 text-sm text-slate-500">The AI quotes these exactly. Leave a policy empty and the AI hands those questions to an agent.</p>
        <div className="mt-4 space-y-4">
          {POLICIES.map(([key, label]) => (
            <div key={key}>
              <Label htmlFor={`st-policy-${key}`}>{label}</Label>
              <textarea id={`st-policy-${key}`} rows={2} value={form.policies[key]} onChange={(e) => set("policies", { ...form.policies, [key]: e.target.value })} aria-describedby={`st-policy-${key}-error`} aria-invalid={!!errors[key]} data-testid={`settings-policy-${key}-input`} className={cls(key)} />
              <FieldError id={`st-policy-${key}-error`} message={errors[key]} testId={`settings-policy-${key}-error`} />
              {counter(form.policies[key], 500, `st-policy-${key}-count`)}
            </div>
          ))}
        </div>
      </Card>

      <div className="sticky bottom-0 z-10 -mx-1 flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white/95 p-3 backdrop-blur" data-testid="settings-save-bar">
        <button type="submit" disabled={saving || !dirty} data-testid="settings-save" className={BTN_PRIMARY}>
          <Save className="h-4 w-4" aria-hidden="true" />
          {saving ? "Saving" : "Save settings"}
        </button>
        {dirty && !saving && <span data-testid="settings-unsaved" className="text-xs text-slate-500">You have unsaved changes.</span>}
        <Notice message={notice} testId="settings-confirmation" />
        <p role="alert" data-testid="settings-save-error" className="min-w-0 flex-1 text-sm font-medium text-red-600">{saveError}</p>
      </div>

      <Card testId="settings-share">
        <h2 className="font-heading text-lg font-semibold text-slate-900">Share your shop</h2>
        <p className="mt-0.5 text-sm text-slate-500">Customers can open this link, browse your products and chat with your shop without creating an account.</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input readOnly aria-label="Storefront link" value={shareUrl} onFocus={(e) => e.currentTarget.select()} data-testid="settings-share-url" className={`${INPUT} min-w-0 flex-1 bg-slate-50 font-mono text-xs`} />
          <CopyButton text={shareUrl} label="Copy link" testId="settings-share-copy" />
          <a href={saved.shareUrlPath} target="_blank" rel="noopener noreferrer" data-testid="settings-share-open" className={BTN_GHOST}>
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
            Open storefront
          </a>
        </div>
      </Card>

      <Card testId="settings-account">
        <h2 className="font-heading text-lg font-semibold text-slate-900">Account</h2>
        <p className="mt-0.5 text-sm text-slate-500">Sign out of the seller studio on this device. Your shop and its data are not affected.</p>
        <button type="button" onClick={signOut} data-testid="settings-sign-out" className={`${BTN_GHOST} mt-3 ${FOCUS}`}>
          <LogOut className="h-4 w-4" aria-hidden="true" />
          Sign out
        </button>
        <p role="alert" data-testid="settings-sign-out-error" className="mt-2 min-h-4 text-sm font-medium text-red-600">{signOutError}</p>
      </Card>

      <NextAction title="Next: teach the AI your terms" text="Add brand and craft names to the glossary so they are never mistranslated." href="/seller/glossary" cta="Open glossary" />
    </form>
  );
}

export default function SettingsManager() {
  const { data, error, loading, reload } = useApi<SettingsDto>("/api/desk/settings");
  return (
    <div>
      {loading && <LoadingBlock label="Loading settings" testId="settings-loading" />}
      {error && !data && <ErrorBlock message={error} onRetry={reload} testId="settings-error" />}
      {data && <SettingsForm initial={data} />}
    </div>
  );
}
