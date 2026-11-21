"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { ExternalLink, LogOut, Save } from "lucide-react";
import { signOut as signOutRequest } from "@/components/platform/auth/session";
import { LanguagePicker } from "@/components/platform/seller/LanguagePicker";
import { BTN_GHOST, BTN_PRIMARY, Card, CopyButton, ErrorBlock, FieldError, FOCUS, INPUT, Label, LoadingBlock, Notice, Toggle } from "@/components/platform/seller/ui";
import { NextAction } from "@/components/platform/ui";
import { api } from "@/lib/v2/client";
import { DAYS, DAY_NAMES, isConfigured, type Day, type WeekHours } from "@/lib/v2/hours";
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

type DayForm = { open: boolean; from: string; to: string };
type HoursForm = Record<Day, DayForm>;

type Form = {
  name: string;
  agentName: string;
  tagline: string;
  about: string;
  country: string;
  hours: string;
  businessHours: HoursForm;
  timezone: string;
  awayMessage: string;
  languages: string[];
  responseTargetMin: string;
  freeAbove: string;
  fee: string;
  worldwideDays: string;
  domesticDays: string;
  shippingNotes: string;
  policies: SettingsDto["policies"];
};

const DEFAULT_FROM = "09:00";
const DEFAULT_TO = "18:00";
const WEEKDAYS: Day[] = ["mon", "tue", "wed", "thu", "fri"];

const hoursPreset = (days: readonly Day[]): HoursForm =>
  Object.fromEntries(DAYS.map((d) => [d, { open: days.includes(d), from: DEFAULT_FROM, to: DEFAULT_TO }])) as HoursForm;

const hoursToForm = (hours: WeekHours): HoursForm =>
  Object.fromEntries(
    DAYS.map((d) => {
      const range = hours[d];
      return [d, range ? { open: true, from: range.open, to: range.close } : { open: false, from: DEFAULT_FROM, to: DEFAULT_TO }];
    }),
  ) as HoursForm;

// A shop with no open day is saved as an empty schedule, which means always open.
const hoursPayload = (form: HoursForm): WeekHours => {
  if (!DAYS.some((d) => form[d].open)) return {};
  return Object.fromEntries(DAYS.map((d) => [d, form[d].open ? { open: form[d].from, close: form[d].to } : null]));
};

const browserZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

// Settings only render in the browser after loading, so the browser's zone is a safe default when no hours were ever saved.
const toForm = (s: SettingsDto): Form => ({
  name: s.name,
  agentName: s.agentName,
  tagline: s.tagline,
  about: s.about,
  country: s.country,
  hours: s.hours,
  businessHours: hoursToForm(s.businessHours),
  timezone: !isConfigured(s.businessHours) && s.timezone === "UTC" ? browserZone() : s.timezone,
  awayMessage: s.awayMessage,
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
  if (f.agentName.length > 40) e.agentName = "The assistant name must be at most 40 characters.";
  if (f.tagline.length > 200) e.tagline = "The tagline must be at most 200 characters.";
  if (f.about.length > 600) e.about = "The description must be at most 600 characters.";
  if (f.country.length > 100) e.country = "The country must be at most 100 characters.";
  if (f.hours.length > 120) e.hours = "The support hours must be at most 120 characters.";
  for (const d of DAYS) {
    const row = f.businessHours[d];
    if (!row.open) continue;
    if (!row.from || !row.to) e[`day-${d}`] = `${DAY_NAMES[d]}: enter an opening and a closing time.`;
    else if (row.to <= row.from) e[`day-${d}`] = `${DAY_NAMES[d]}: the closing time must be after the opening time.`;
  }
  if (f.awayMessage.length > 200) e.awayMessage = "The away message must be at most 200 characters.";
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
  const origin = useSyncExternalStore(originStore.subscribe, originStore.client, originStore.server);
  const [saved, setSaved] = useState(initial);
  const [form, setForm] = useState<Form>(() => toForm(initial));
  const zones = useMemo(() => {
    const supported = (Intl as unknown as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf?.("timeZone") ?? [];
    return Array.from(new Set(["UTC", ...supported, form.timezone])).sort();
    // The list only needs to include the zone selected when the form opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
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
          agentName: form.agentName.trim(),
          tagline: form.tagline.trim(),
          about: form.about.trim(),
          country: form.country.trim(),
          hours: form.hours.trim(),
          businessHours: hoursPayload(form.businessHours),
          timezone: form.timezone,
          awayMessage: form.awayMessage.trim(),
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
    const failure = await signOutRequest();
    if (failure) setSignOutError(failure);
  };

  const counter = (value: string, max: number, id: string) => (
    <p id={id} className={`mt-1 text-right text-xs ${value.length > max ? "font-semibold text-red-600" : "text-slate-500"}`}>{value.length} / {max}</p>
  );

  return (
    <form onSubmit={submit} noValidate className="space-y-6">
      <Card testId="settings-assistant">
        <h2 className="font-heading text-lg font-semibold text-slate-900">Your AI assistant</h2>
        <p className="mt-0.5 text-sm text-slate-500">
          Every shop has its own AI assistant, already working for you. It answers customers in their language using only your products, policies, knowledge base and glossary. When it cannot answer, it tells the customer the shop will reply and sends you a notification in the app.
        </p>
        <div className="mt-4 max-w-md">
          <Label htmlFor="st-agent-name" hint={`Customers see this name in the chat. Leave it empty to use "${form.name.trim() || "Your shop"} Assistant".`}>Assistant name</Label>
          <input id="st-agent-name" value={form.agentName} maxLength={40} onChange={(e) => set("agentName", e.target.value)} aria-describedby="st-agent-name-error" aria-invalid={!!errors.agentName} data-testid="settings-agent-name-input" className={cls("agentName")} />
          <FieldError id="st-agent-name-error" message={errors.agentName} testId="settings-agent-name-error" />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/seller/knowledge" data-testid="settings-assistant-knowledge" className={`${BTN_GHOST} !px-3 !py-1.5`}>Teach it with your knowledge base</Link>
          <Link href="/seller/glossary" data-testid="settings-assistant-tone" className={`${BTN_GHOST} !px-3 !py-1.5`}>Set its tone and glossary</Link>
        </div>
      </Card>

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
            <Label htmlFor="st-hours" hint="When you or your team can reply, for example Mon to Fri, 09:00 to 18:00 IST.">Support hours</Label>
            <input id="st-hours" value={form.hours} onChange={(e) => set("hours", e.target.value)} aria-describedby="st-hours-error" aria-invalid={!!errors.hours} data-testid="settings-hours-input" className={cls("hours")} />
            <FieldError id="st-hours-error" message={errors.hours} testId="settings-hours-error" />
          </div>
        </div>
      </Card>

      <Card testId="settings-business-hours">
        <h2 className="font-heading text-lg font-semibold text-slate-900">Business hours</h2>
        <p className="mt-0.5 text-sm text-slate-500">
          When the shop is closed, the assistant tells customers when the team is back, and the response-time clock for a new request starts at the next opening. Leave every day switched off to be available at all times.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => set("businessHours", hoursPreset(WEEKDAYS))} data-testid="settings-hours-preset-weekdays" className={`${BTN_GHOST} !px-3 !py-1.5`}>Monday to Friday, 09:00 to 18:00</button>
          <button type="button" onClick={() => set("businessHours", hoursPreset(DAYS))} data-testid="settings-hours-preset-every-day" className={`${BTN_GHOST} !px-3 !py-1.5`}>Every day, 09:00 to 18:00</button>
        </div>
        <ul className="mt-4 divide-y divide-slate-100" aria-label="Opening times by weekday">
          {DAYS.map((d) => {
            const row = form.businessHours[d];
            const setRow = (patch: Partial<DayForm>) => set("businessHours", { ...form.businessHours, [d]: { ...row, ...patch } });
            const bad = !!errors[`day-${d}`];
            return (
              <li key={d} data-testid={`settings-hours-row-${d}`} className="py-2.5">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <div className="flex w-32 items-center gap-3">
                    <Toggle checked={row.open} onChange={(v) => setRow({ open: v })} label={`${DAY_NAMES[d]} open`} testId={`settings-hours-${d}-open`} />
                    <span className="text-sm font-medium text-slate-800">{DAY_NAMES[d]}</span>
                  </div>
                  {row.open ? (
                    <div className="flex items-center gap-2">
                      <input type="time" aria-label={`${DAY_NAMES[d]} opening time`} value={row.from} onChange={(e) => setRow({ from: e.target.value })} aria-invalid={bad} data-testid={`settings-hours-${d}-from`} className={`${INPUT} w-32 ${bad ? "border-red-400" : ""}`} />
                      <span className="text-sm text-slate-500">to</span>
                      <input type="time" aria-label={`${DAY_NAMES[d]} closing time`} value={row.to} onChange={(e) => setRow({ to: e.target.value })} aria-invalid={bad} data-testid={`settings-hours-${d}-to`} className={`${INPUT} w-32 ${bad ? "border-red-400" : ""}`} />
                    </div>
                  ) : (
                    <span className="text-sm text-slate-500">Closed</span>
                  )}
                </div>
                <FieldError id={`st-hours-${d}-error`} message={errors[`day-${d}`]} testId={`settings-hours-${d}-error`} />
              </li>
            );
          })}
        </ul>
        <div className="mt-4 max-w-md">
          <Label htmlFor="st-timezone" hint="The opening times above are in this time zone.">Time zone</Label>
          <select id="st-timezone" value={form.timezone} onChange={(e) => set("timezone", e.target.value)} data-testid="settings-timezone-select" className={INPUT}>
            {zones.map((z) => (
              <option key={z} value={z}>{z}</option>
            ))}
          </select>
        </div>
        <div className="mt-4">
          <Label htmlFor="st-away" hint="Shown to customers while the shop is closed, for example when replies resume.">Away message</Label>
          <textarea id="st-away" rows={2} value={form.awayMessage} onChange={(e) => set("awayMessage", e.target.value)} aria-describedby="st-away-error st-away-count" aria-invalid={!!errors.awayMessage} data-testid="settings-away-message-input" className={cls("awayMessage")} />
          <FieldError id="st-away-error" message={errors.awayMessage} testId="settings-away-message-error" />
          {counter(form.awayMessage, 200, "st-away-count")}
        </div>
      </Card>

      <Card testId="settings-languages">
        <h2 className="font-heading text-lg font-semibold text-slate-900">Languages</h2>
        <p className="mt-0.5 mb-3 text-sm text-slate-500">Languages your shop serves. English is always included because your team works in English.</p>
        <LanguagePicker value={form.languages} onChange={(next) => set("languages", next)} idPrefix="settings" locked={["en"]} label="Shop languages" />
      </Card>

      <Card testId="settings-response">
        <h2 className="font-heading text-lg font-semibold text-slate-900">Response target</h2>
        <p className="mt-0.5 text-sm text-slate-500">How many minutes a customer waits for a reply from you or your team before the conversation counts as overdue.</p>
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
        <p className="mt-0.5 text-sm text-slate-500">The AI quotes these exactly. Leave a policy empty and the AI passes those questions to you.</p>
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
