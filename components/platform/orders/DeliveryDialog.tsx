"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin, X } from "lucide-react";
import { EMPTY_DELIVERY, validateDelivery, type Delivery } from "@/lib/v2/delivery";

const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2";
const STORE_KEY = "linguadesk.delivery";
const INPUT = `mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 ${FOCUS}`;

type Field = { key: keyof Delivery; label: string; autoComplete: string; optional?: boolean; half?: boolean; type?: string; hint?: string };

const FIELDS: Field[] = [
  { key: "fullName", label: "Full name", autoComplete: "name" },
  { key: "phone", label: "Phone number", autoComplete: "tel", type: "tel", hint: "The courier may call this number." },
  { key: "line1", label: "Address", autoComplete: "address-line1", hint: "House number and street." },
  { key: "line2", label: "Apartment, floor or landmark", autoComplete: "address-line2", optional: true },
  { key: "city", label: "City", autoComplete: "address-level2", half: true },
  { key: "region", label: "State or region", autoComplete: "address-level1", optional: true, half: true },
  { key: "postalCode", label: "Postal code", autoComplete: "postal-code", half: true },
  { key: "country", label: "Country", autoComplete: "country-name", half: true },
];

// The last address used on this device, so a returning buyer does not retype it. It never leaves the browser except when an order is confirmed.
function remembered(): Delivery {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? { ...EMPTY_DELIVERY, ...(JSON.parse(raw) as Partial<Delivery>) } : EMPTY_DELIVERY;
  } catch {
    return EMPTY_DELIVERY;
  }
}

type Props = {
  shopName?: string;
  busy: boolean;
  error: string | null;
  onSubmit: (delivery: Delivery) => void;
  onClose: () => void;
};

// Asked once when the buyer confirms an order: where to send it. Shown over the page so the buyer never loses their place.
export default function DeliveryDialog({ shopName, busy, error, onSubmit, onClose }: Props) {
  const [form, setForm] = useState<Delivery>(EMPTY_DELIVERY);
  const [problem, setProblem] = useState<{ field?: keyof Delivery; message: string } | null>(null);
  const firstRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm(remembered());
    firstRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = validateDelivery(form);
    if (!parsed.ok) {
      setProblem({ field: parsed.field, message: parsed.error });
      if (parsed.field) document.getElementById(`delivery-${parsed.field}`)?.focus();
      return;
    }
    setProblem(null);
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(parsed.delivery));
    } catch {
      // Storage can be blocked; the order still goes through.
    }
    onSubmit(parsed.delivery);
  }

  const shown = problem?.message ?? error;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4" data-testid="delivery-overlay">
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="delivery-title"
        onSubmit={submit}
        noValidate
        data-testid="delivery-dialog"
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="delivery-title" className="flex items-center gap-2 font-heading text-lg font-semibold text-slate-900">
              <MapPin className="h-5 w-5 text-indigo-600" aria-hidden="true" /> Where should we deliver?
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {shopName ? `${shopName} uses` : "The shop uses"} this address to send your order. Only the shop team can see it.
            </p>
          </div>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Close" data-testid="delivery-close" className={`rounded-full p-1.5 text-slate-500 hover:bg-slate-100 ${FOCUS}`}>
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          {FIELDS.map((f, i) => (
            <div key={f.key} className={f.half ? "col-span-2 sm:col-span-1" : "col-span-2"}>
              <label htmlFor={`delivery-${f.key}`} className="text-sm font-medium text-slate-800">
                {f.label}
                {f.optional && <span className="font-normal text-slate-500"> (optional)</span>}
              </label>
              <input
                id={`delivery-${f.key}`}
                ref={i === 0 ? firstRef : undefined}
                type={f.type ?? "text"}
                autoComplete={f.autoComplete}
                value={form[f.key]}
                onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))}
                aria-invalid={problem?.field === f.key}
                aria-describedby={f.hint ? `delivery-${f.key}-hint` : undefined}
                data-testid={`delivery-${f.key}`}
                className={`${INPUT} ${problem?.field === f.key ? "border-red-400" : ""}`}
              />
              {f.hint && (
                <p id={`delivery-${f.key}-hint`} className="mt-0.5 text-xs text-slate-500">
                  {f.hint}
                </p>
              )}
            </div>
          ))}
        </div>

        {shown && (
          <p role="alert" data-testid="delivery-error" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 ring-1 ring-red-200">
            {shown}
          </p>
        )}

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} disabled={busy} data-testid="delivery-cancel" className={`rounded-full border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 ${FOCUS}`}>
            Not now
          </button>
          <button type="submit" disabled={busy} data-testid="delivery-submit" className={`rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300 ${FOCUS}`}>
            {busy ? "Confirming..." : "Confirm order"}
          </button>
        </div>
      </form>
    </div>
  );
}
