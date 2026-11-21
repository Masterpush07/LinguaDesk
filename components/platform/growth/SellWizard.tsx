"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { AlertCircle, ArrowLeft, ArrowRight, Check, CheckCircle2, Copy, ExternalLink, Loader2, Plus, Rocket, X } from "lucide-react";
import { deskPath, notifyAuthChanged, useCurrentStaff } from "@/components/platform/auth/session";
import { FormError, FOCUS, INPUT, PRIMARY_BUTTON, PasscodeField, SECONDARY_BUTTON, TextField } from "@/components/platform/auth/fields";
import { LanguagePicker } from "@/components/platform/auth/LanguagePicker";
import { api } from "@/lib/v2/client";

const STEPS = ["Create your shop", "Add products", "Teach the AI", "Launch"];
const COUNTRIES = ["India", "Japan", "Indonesia", "Rwanda", "Mexico", "Brazil", "France", "United Kingdom", "United States"];
const MAX_FAQS = 3;

type Created = { slug: string; name: string };
type ParsedLine = { raw: string; name: string; price: number | null; problem: string | null };
type Faq = { q: string; a: string };
type CurrentSettings = { shipping: Record<string, unknown>; policies: Record<string, unknown> } & Record<string, unknown>;

const EXAMPLE = "Trousers - 90";

// The price is the last number on the line. The name may be separated by a dash, colon, comma or just a space,
// so "Trousers - 90", "Trousers-90", "Trousers: $90" and "Trousers 90" are all read the same way.
const PRODUCT_LINE = /^(.+?)\s*(?:[-–—:=,|@]\s*|\s)\$?\s*(\d+(?:[.,]\d+)*)\s*(?:\$|usd|dollars?)?$/i;

const parseProductLine = (raw: string): ParsedLine => {
  const match = PRODUCT_LINE.exec(raw);
  if (!match) {
    const startsWithNumber = /^\$?\s*\d/.test(raw);
    return { raw, name: raw, price: null, problem: startsWithNumber ? `Write the name first, then the price. For example: ${EXAMPLE}` : `Add a price after the name. For example: ${EXAMPLE}` };
  }
  const name = match[1].trim();
  const digits = match[2];
  const price = /^\d{1,3}(,\d{3})+$/.test(digits) ? Number(digits.replace(/,/g, "")) : Number(digits.replace(",", "."));
  if (!Number.isInteger(price)) return { raw, name, price: null, problem: "Use a whole number of US dollars, without cents" };
  if (price < 1) return { raw, name, price: null, problem: "The price must be at least $1" };
  return { raw, name, price, problem: null };
};

const parseProducts = (text: string): ParsedLine[] => {
  const seen = new Set<string>();
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter((raw) => raw && !seen.has(raw) && seen.add(raw))
    .map(parseProductLine);
};

const toWhole = (v: string): number | null => {
  const t = v.trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isInteger(n) && n >= 0 ? n : NaN;
};

function strength(p: string): { label: string; level: number } {
  if (!p) return { label: "", level: 0 };
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(p)).length;
  const words = p.trim().split(/\s+/).length;
  const score = (p.length >= 8 ? 1 : 0) + (p.length >= 12 ? 1 : 0) + (p.length >= 16 ? 1 : 0) + (classes >= 3 || words >= 3 ? 1 : 0);
  if (p.length < 8) return { label: "Too short", level: 1 };
  if (score <= 2) return { label: "Fair", level: 2 };
  if (score === 3) return { label: "Good", level: 3 };
  return { label: "Strong", level: 4 };
}

const message = (err: unknown) => (err instanceof Error ? err.message : "Something went wrong.");

function Field({ label, htmlFor, hint, children }: { label: string; htmlFor: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1 block text-sm font-medium text-slate-800">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export default function SellWizard() {
  const me = useCurrentStaff();
  const [step, setStep] = useState(0);
  const [created, setCreated] = useState<Created | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const mounted = useRef(false);

  // Step 1: the shop
  const [shopName, setShopName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [passcode, setPasscode] = useState("");
  const [confirm, setConfirm] = useState("");
  const [country, setCountry] = useState("");
  const [tagline, setTagline] = useState("");
  const [languages, setLanguages] = useState<string[]>(["en"]);
  const [shopError, setShopError] = useState("");
  const [creating, setCreating] = useState(false);

  // Step 2: products
  const [productText, setProductText] = useState("");
  const [stock, setStock] = useState("10");
  const [savedLines, setSavedLines] = useState<string[]>([]);
  const [lineErrors, setLineErrors] = useState<Record<string, string>>({});
  const [savingProducts, setSavingProducts] = useState(false);

  // Step 3: AI setup
  const [fee, setFee] = useState("");
  const [freeAbove, setFreeAbove] = useState("");
  const [worldwideDays, setWorldwideDays] = useState("");
  const [domesticDays, setDomesticDays] = useState("");
  const [returns, setReturns] = useState("");
  const [faqs, setFaqs] = useState<Faq[]>([{ q: "", a: "" }]);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [savedFaqs, setSavedFaqs] = useState<string[]>([]);
  const [aiErrors, setAiErrors] = useState<string[]>([]);
  const [savingAi, setSavingAi] = useState(false);

  // Step 4: launch
  const [link, setLink] = useState("");
  const [qr, setQr] = useState("");
  const [copied, setCopied] = useState<"" | "yes" | "failed">("");

  useEffect(() => {
    if (mounted.current) headingRef.current?.focus();
    mounted.current = true;
  }, [step]);

  useEffect(() => {
    if (step !== 3 || !created) return;
    const url = `${window.location.origin}/s/${created.slug}`;
    let alive = true;
    QRCode.toDataURL(url, { margin: 1, width: 240, errorCorrectionLevel: "M" })
      .then((dataUrl) => {
        if (!alive) return;
        setLink(url);
        setQr(dataUrl);
      })
      .catch(() => alive && setLink(url));
    return () => {
      alive = false;
    };
  }, [step, created]);

  const parsed = useMemo(() => parseProducts(productText), [productText]);
  const stockValue = toWhole(stock);
  const stockInvalid = stockValue === null || Number.isNaN(stockValue);
  const pending = parsed.filter((p) => p.price !== null && !savedLines.includes(p.raw));
  const pw = strength(passcode);

  async function createShop(e: FormEvent) {
    e.preventDefault();
    if (created) return setStep(1);
    if (shopName.trim().length < 2) return setShopError("Enter a shop name of at least 2 characters.");
    if (ownerName.trim().length < 2) return setShopError("Enter your name.");
    if (passcode.length < 8) return setShopError("Choose a passcode of at least 8 characters.");
    if (passcode !== confirm) return setShopError("The passcode and its confirmation do not match.");
    setCreating(true);
    setShopError("");
    try {
      const res = await api<{ seller: Created }>("/api/auth/signup", {
        method: "POST",
        json: { shopName, ownerName, passcode, country, tagline, languages },
      });
      setCreated({ slug: res.seller.slug, name: res.seller.name });
      notifyAuthChanged();
      setStep(1);
    } catch (err) {
      setShopError(message(err));
    } finally {
      setCreating(false);
    }
  }

  async function saveProducts() {
    if (stockInvalid || pending.length === 0) return;
    setSavingProducts(true);
    const errors: Record<string, string> = {};
    const done: string[] = [];
    for (const line of pending) {
      try {
        await api("/api/desk/products", { method: "POST", json: { name: line.name, priceUsd: line.price, stock: stockValue } });
        done.push(line.raw);
      } catch (err) {
        errors[line.raw] = message(err);
      }
    }
    setSavedLines((s) => [...s, ...done]);
    setLineErrors(errors);
    setSavingProducts(false);
    if (Object.keys(errors).length === 0) setStep(2);
  }

  const filledFaqs = faqs.filter((f) => f.q.trim() && f.a.trim());
  const feeValue = toWhole(fee);
  const freeValue = toWhole(freeAbove);
  const numbersInvalid = Number.isNaN(feeValue) || Number.isNaN(freeValue);
  const hasSettings = Boolean(fee.trim() || freeAbove.trim() || worldwideDays.trim() || domesticDays.trim() || returns.trim());
  const pendingFaqs = filledFaqs.filter((f) => !savedFaqs.includes(`${f.q}\n${f.a}`));
  const nothingToSave = (!hasSettings || settingsSaved) && pendingFaqs.length === 0;

  async function saveAi() {
    if (numbersInvalid) return;
    setSavingAi(true);
    const errors: string[] = [];
    if (hasSettings && !settingsSaved) {
      try {
        // The settings endpoint replaces the whole record, so start from what is stored and change only these fields.
        const current = await api<CurrentSettings>("/api/desk/settings");
        await api("/api/desk/settings", {
          method: "PUT",
          json: {
            ...current,
            shipping: {
              ...current.shipping,
              ...(feeValue !== null && { fee: feeValue }),
              ...(freeValue !== null && { freeAbove: freeValue }),
              ...(worldwideDays.trim() && { worldwideDays: worldwideDays.trim() }),
              ...(domesticDays.trim() && { domesticDays: domesticDays.trim() }),
            },
            policies: { ...current.policies, ...(returns.trim() && { returns: returns.trim() }) },
          },
        });
        setSettingsSaved(true);
      } catch (err) {
        errors.push(`Shipping and returns were not saved: ${message(err)}`);
      }
    }
    for (const f of pendingFaqs) {
      try {
        await api("/api/desk/faqs", { method: "POST", json: { q: f.q.trim(), a: f.a.trim() } });
        setSavedFaqs((s) => [...s, `${f.q}\n${f.a}`]);
      } catch (err) {
        errors.push(`The question "${f.q.trim()}" was not saved: ${message(err)}`);
      }
    }
    setAiErrors(errors);
    setSavingAi(false);
    if (errors.length === 0) setStep(3);
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied("yes");
    } catch {
      setCopied("failed");
    }
    setTimeout(() => setCopied(""), 2500);
  }

  const savedCount = savedLines.length;

  return (
    <div className="mx-auto max-w-3xl" data-testid="sell-wizard">
      <ol className="mb-6 grid grid-cols-4 gap-2" aria-label="Setup progress">
        {STEPS.map((label, i) => {
          const done = i < step;
          const current = i === step;
          return (
            <li key={label} data-testid={`wizard-step-${i + 1}`} aria-current={current ? "step" : undefined} className="min-w-0">
              <div className={`h-1.5 rounded-full ${done || current ? "bg-indigo-600" : "bg-slate-200"}`} />
              <p className={`mt-2 flex items-center gap-1.5 text-xs font-medium ${current ? "text-indigo-700" : done ? "text-slate-700" : "text-slate-400"}`}>
                {done ? <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> : <span className="font-mono">{i + 1}</span>}
                <span className="truncate">{label}</span>
              </p>
            </li>
          );
        })}
      </ol>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        {step === 0 && (
          <form onSubmit={createShop} className="space-y-5" data-testid="wizard-form-shop">
            <div>
              <h2 ref={headingRef} tabIndex={-1} className="font-heading text-2xl font-semibold text-slate-900 focus:outline-none">
                Create your shop
              </h2>
              <p className="mt-1 text-sm text-slate-600">This creates your owner account. You will use the shop name, your name and the passcode to sign in.</p>
            </div>

            {me && !created && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800" data-testid="wizard-signed-in-notice">
                You are signed in as {me.name} of {me.sellerName}. Creating a new shop replaces this session.{" "}
                <Link href={deskPath(me.role)} className="font-medium underline underline-offset-2">
                  Open your desk instead
                </Link>
              </p>
            )}
            {created && (
              <p className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800" role="status" data-testid="wizard-shop-created">
                <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" /> {created.name} has been created. Continue to add products.
              </p>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="Shop name" testId="wizard-shop-name" value={shopName} onChange={setShopName} maxLength={60} disabled={creating || !!created} autoComplete="organization" required />
              <TextField label="Your name" testId="wizard-owner-name" value={ownerName} onChange={setOwnerName} maxLength={60} disabled={creating || !!created} autoComplete="name" required />
            </div>

            {!created && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <PasscodeField
                    label="Passcode"
                    testId="wizard-passcode"
                    value={passcode}
                    onChange={setPasscode}
                    hint="At least 8 characters. A phrase of three or more words works well."
                    autoComplete="new-password"
                    disabled={creating}
                  />
                  {passcode && (
                    <div className="mt-2" data-testid="wizard-passcode-strength" aria-live="polite">
                      <div className="flex gap-1" aria-hidden="true">
                        {[1, 2, 3, 4].map((n) => (
                          <span key={n} className={`h-1 flex-1 rounded-full ${n <= pw.level ? (pw.level <= 1 ? "bg-red-500" : pw.level === 2 ? "bg-amber-500" : "bg-emerald-500") : "bg-slate-200"}`} />
                        ))}
                      </div>
                      <p className="mt-1 text-xs text-slate-500">Strength: {pw.label}</p>
                    </div>
                  )}
                </div>
                <PasscodeField label="Confirm passcode" testId="wizard-passcode-confirm" value={confirm} onChange={setConfirm} autoComplete="new-password" disabled={creating} />
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Country" htmlFor="wizard-country">
                <input
                  id="wizard-country"
                  data-testid="wizard-country"
                  list="wizard-country-options"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  maxLength={60}
                  disabled={creating || !!created}
                  className={INPUT}
                />
                <datalist id="wizard-country-options">
                  {COUNTRIES.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </Field>
              <TextField label="Short description" testId="wizard-tagline" value={tagline} onChange={setTagline} maxLength={200} placeholder="What does your shop make or sell?" disabled={creating || !!created} />
            </div>

            <LanguagePicker value={languages} onChange={setLanguages} disabled={creating || !!created} idPrefix="wizard" />

            <FormError message={shopError} testId="wizard-shop-error" />

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-slate-500">
                Already have a shop?{" "}
                <Link href="/login" data-testid="wizard-sign-in-link" className="font-medium text-indigo-600 underline underline-offset-2">
                  Sign in
                </Link>
              </p>
              <button type="submit" disabled={creating} data-testid="wizard-create-shop" className={PRIMARY_BUTTON}>
                {creating ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <ArrowRight className="h-4 w-4" aria-hidden="true" />}
                {creating ? "Creating your shop" : created ? "Continue" : "Create shop and continue"}
              </button>
            </div>
          </form>
        )}

        {step === 1 && (
          <div className="space-y-5" data-testid="wizard-step-products">
            <div>
              <h2 ref={headingRef} tabIndex={-1} className="font-heading text-2xl font-semibold text-slate-900 focus:outline-none">
                Add products
              </h2>
              <p className="mt-1 text-sm text-slate-600">Write one product per line, with its price in whole US dollars after the name. You can add images, colours and more later in Inventory.</p>
            </div>
            <Field label="Products" htmlFor="wizard-products" hint={`One product per line, for example: ${EXAMPLE}`}>
              <textarea
                id="wizard-products"
                data-testid="wizard-products"
                value={productText}
                onChange={(e) => setProductText(e.target.value)}
                rows={5}
                disabled={savingProducts}
                placeholder={"Trousers - 90\nCotton shirt - 45"}
                className={`${INPUT} font-mono`}
              />
            </Field>
            <div className="max-w-xs">
              <TextField label="Units in stock for each product" testId="wizard-stock" value={stock} onChange={setStock} hint="Whole number. Use 0 for items made to order." disabled={savingProducts} />
              {stockInvalid && <p className="mt-1 text-xs text-red-600">Enter a whole number, 0 or higher.</p>}
            </div>

            {parsed.length > 0 && (
              <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200" data-testid="wizard-product-list" aria-label="Products to add">
                {parsed.map((p, i) => {
                  const saved = savedLines.includes(p.raw);
                  const err = lineErrors[p.raw];
                  return (
                    <li key={p.raw} data-testid={`wizard-product-row-${i}`} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                      <span className="min-w-0 truncate font-medium text-slate-800">{p.name}</span>
                      <span className="flex items-center gap-2">
                        {p.price !== null && <span className="text-slate-600">${p.price}</span>}
                        {saved ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                            <Check className="h-3 w-3" aria-hidden="true" /> Saved
                          </span>
                        ) : p.price === null ? (
                          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">{p.problem}</span>
                        ) : err ? (
                          <span role="alert" className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                            {err}
                          </span>
                        ) : (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">Ready</span>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}

            {Object.keys(lineErrors).length > 0 && (
              <p role="alert" data-testid="wizard-products-error" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> Some products were not saved. Try again, or continue and add them later from Inventory.
              </p>
            )}

            {pending.length === 0 && !savingProducts && (
              <p data-testid="wizard-products-hint" className="text-sm text-slate-600" aria-live="polite">
                {parsed.length === 0
                  ? "Add at least one product to continue, or skip this step and add products later from Inventory."
                  : parsed.every((p) => savedLines.includes(p.raw))
                    ? "These products are saved. Continue to the next step."
                    : "Fix the highlighted lines to continue, or skip this step and add products later from Inventory."}
              </p>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <button type="button" onClick={() => setStep(0)} data-testid="wizard-back" className={SECONDARY_BUTTON}>
                <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back
              </button>
              <div className="flex flex-wrap gap-3">
                <button type="button" onClick={() => setStep(2)} data-testid="wizard-skip-products" className={SECONDARY_BUTTON}>
                  {savedCount > 0 || Object.keys(lineErrors).length > 0 ? "Continue without saving more" : "Skip for now"}
                </button>
                <button type="button" onClick={() => void saveProducts()} disabled={savingProducts || stockInvalid || pending.length === 0} data-testid="wizard-save-products" className={PRIMARY_BUTTON}>
                  {savingProducts ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Plus className="h-4 w-4" aria-hidden="true" />}
                  {savingProducts ? "Saving products" : pending.length === 0 ? "Save products and continue" : `Save ${pending.length} ${pending.length === 1 ? "product" : "products"} and continue`}
                </button>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5" data-testid="wizard-step-ai">
            <div>
              <h2 ref={headingRef} tabIndex={-1} className="font-heading text-2xl font-semibold text-slate-900 focus:outline-none">
                Teach the AI
              </h2>
              <p className="mt-1 text-sm text-slate-600">The AI assistant answers only from what you write here. Anything it cannot answer is passed to your team.</p>
            </div>

            <fieldset className="space-y-4" disabled={savingAi}>
              <legend className="font-heading text-base font-semibold text-slate-900">Shipping</legend>
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField label="Shipping fee (US dollars)" testId="wizard-ship-fee" value={fee} onChange={setFee} placeholder="0" />
                <TextField label="Free shipping above (US dollars)" testId="wizard-ship-free-above" value={freeAbove} onChange={setFreeAbove} hint="Leave empty if shipping is never free." />
                <TextField label="Worldwide delivery time" testId="wizard-ship-worldwide" value={worldwideDays} onChange={setWorldwideDays} placeholder="For example, 5 to 7 business days" />
                <TextField label="Domestic delivery time" testId="wizard-ship-domestic" value={domesticDays} onChange={setDomesticDays} />
              </div>
              {numbersInvalid && (
                <p role="alert" className="text-xs text-red-600">
                  Enter whole numbers for the shipping fee and the free shipping amount.
                </p>
              )}
              <Field label="Returns policy" htmlFor="wizard-returns">
                <textarea id="wizard-returns" data-testid="wizard-returns" value={returns} onChange={(e) => setReturns(e.target.value)} rows={3} className={INPUT} />
              </Field>
            </fieldset>

            <fieldset className="space-y-3" disabled={savingAi}>
              <legend className="font-heading text-base font-semibold text-slate-900">Frequently asked questions</legend>
              {faqs.map((f, i) => (
                <div key={i} className="space-y-2 rounded-xl border border-slate-200 p-3" data-testid={`wizard-faq-${i}`}>
                  <div className="flex items-start gap-2">
                    <div className="flex-1">
                      <label htmlFor={`wizard-faq-q-${i}`} className="sr-only">{`Question ${i + 1}`}</label>
                      <input
                        id={`wizard-faq-q-${i}`}
                        data-testid={`wizard-faq-q-${i}`}
                        value={f.q}
                        onChange={(e) => setFaqs((all) => all.map((x, j) => (j === i ? { ...x, q: e.target.value } : x)))}
                        placeholder="Question"
                        maxLength={200}
                        className={INPUT}
                      />
                    </div>
                    {faqs.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setFaqs((all) => all.filter((_, j) => j !== i))}
                        aria-label={`Remove question ${i + 1}`}
                        data-testid={`wizard-faq-remove-${i}`}
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 ${FOCUS}`}
                      >
                        <X className="h-4 w-4" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                  <label htmlFor={`wizard-faq-a-${i}`} className="sr-only">{`Answer ${i + 1}`}</label>
                  <textarea
                    id={`wizard-faq-a-${i}`}
                    data-testid={`wizard-faq-a-${i}`}
                    value={f.a}
                    onChange={(e) => setFaqs((all) => all.map((x, j) => (j === i ? { ...x, a: e.target.value } : x)))}
                    placeholder="Answer"
                    rows={2}
                    maxLength={1000}
                    className={INPUT}
                  />
                </div>
              ))}
              {faqs.length < MAX_FAQS && (
                <button type="button" onClick={() => setFaqs((all) => [...all, { q: "", a: "" }])} data-testid="wizard-add-faq" className={`inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-700 ${FOCUS} rounded`}>
                  <Plus className="h-4 w-4" aria-hidden="true" /> Add a question
                </button>
              )}
            </fieldset>

            {aiErrors.length > 0 && (
              <div role="alert" data-testid="wizard-ai-error" className="space-y-1 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {aiErrors.map((e) => (
                  <p key={e}>{e}</p>
                ))}
                <p>You can continue and complete this later in Knowledge and Settings.</p>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <button type="button" onClick={() => setStep(1)} data-testid="wizard-back" className={SECONDARY_BUTTON}>
                <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back
              </button>
              <div className="flex flex-wrap gap-3">
                <button type="button" onClick={() => setStep(3)} data-testid="wizard-skip-ai" className={SECONDARY_BUTTON}>
                  {aiErrors.length > 0 ? "Continue anyway" : "Skip for now"}
                </button>
                <button type="button" onClick={() => void saveAi()} disabled={savingAi || numbersInvalid || nothingToSave} data-testid="wizard-save-ai" className={PRIMARY_BUTTON}>
                  {savingAi ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <ArrowRight className="h-4 w-4" aria-hidden="true" />}
                  {savingAi ? "Saving" : "Save and continue"}
                </button>
              </div>
            </div>
          </div>
        )}

        {step === 3 && created && (
          <div className="space-y-6" data-testid="wizard-step-launch">
            <div>
              <h2 ref={headingRef} tabIndex={-1} className="flex items-center gap-2 font-heading text-2xl font-semibold text-slate-900 focus:outline-none">
                <Rocket className="h-6 w-6 text-indigo-600" aria-hidden="true" /> {created.name} is ready
              </h2>
              <p className="mt-1 text-sm text-slate-600">Share this link with customers. They can browse your products and start a conversation in their own language.</p>
            </div>

            <ul className="grid gap-2 text-sm text-slate-600 sm:grid-cols-3" data-testid="wizard-summary">
              <li className="rounded-lg bg-slate-50 px-3 py-2">{savedCount} {savedCount === 1 ? "product" : "products"} added</li>
              <li className="rounded-lg bg-slate-50 px-3 py-2">{settingsSaved ? "Shipping and returns saved" : "Shipping and returns not set"}</li>
              <li className="rounded-lg bg-slate-50 px-3 py-2">{savedFaqs.length} {savedFaqs.length === 1 ? "question" : "questions"} added</li>
            </ul>

            <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
              <div className="min-w-0 flex-1 space-y-3">
                <label htmlFor="wizard-share-link" className="block text-sm font-medium text-slate-800">
                  Your shop link
                </label>
                <div className="flex gap-2">
                  <input id="wizard-share-link" data-testid="wizard-share-link" readOnly value={link} className={`${INPUT} font-mono`} onFocus={(e) => e.currentTarget.select()} />
                  <button type="button" onClick={() => void copyLink()} disabled={!link} data-testid="wizard-copy-link" className={`${SECONDARY_BUTTON} shrink-0`}>
                    <Copy className="h-4 w-4" aria-hidden="true" /> {copied === "yes" ? "Copied" : "Copy"}
                  </button>
                </div>
                <p className="text-xs text-slate-500" role="status" data-testid="wizard-copy-status">
                  {copied === "yes" ? "The link is on your clipboard." : copied === "failed" ? "Copying is not available here. Select the link and copy it." : ""}
                </p>
                <div className="flex flex-wrap gap-3 pt-1">
                  <Link href={`/s/${created.slug}`} data-testid="wizard-view-shop" className={PRIMARY_BUTTON}>
                    <ExternalLink className="h-4 w-4" aria-hidden="true" /> View your shop
                  </Link>
                  <Link href="/seller" data-testid="wizard-open-desk" className={SECONDARY_BUTTON}>
                    Open your desk
                  </Link>
                </div>
              </div>
              <div className="shrink-0 self-center">
                {qr ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={qr} alt={`QR code that opens ${created.name}`} width={160} height={160} data-testid="wizard-qr" className="h-40 w-40 rounded-lg border border-slate-200 bg-white p-1" />
                ) : (
                  <div className="h-40 w-40 animate-pulse rounded-lg bg-slate-100 motion-reduce:animate-none" role="status" aria-label="Preparing the QR code" data-testid="wizard-qr-loading" />
                )}
              </div>
            </div>

            <div>
              <button type="button" onClick={() => setStep(2)} data-testid="wizard-back" className={SECONDARY_BUTTON}>
                <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
