"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, ShieldCheck } from "lucide-react";
import { Price } from "@/components/platform/Prefs";

type Plan = { id: string; name: string; tagline: string; monthly: number; yearlyMonthly: number; features: string[]; featured?: boolean };

const PLANS: Plan[] = [
  {
    id: "starter",
    name: "Starter",
    tagline: "Try LinguaDesk with your first customers.",
    monthly: 0,
    yearlyMonthly: 0,
    features: ["1 shop", "3 customer languages", "100 AI chats a month", "Up to 10 knowledge-base answers", "Number-checked translation", "Order tracking for customers"],
  },
  {
    id: "growth",
    name: "Growth",
    tagline: "For shops that sell abroad every week.",
    monthly: 29,
    yearlyMonthly: 24,
    featured: true,
    features: ["Everything in Starter", "10 customer languages", "1,000 AI chats a month", "Voice messages with translation review", "AI glossary and tone settings", "3 team seats", "Performance reports"],
  },
  {
    id: "scale",
    name: "Scale",
    tagline: "For busy shops with a support team.",
    monthly: 99,
    yearlyMonthly: 82,
    features: ["Everything in Growth", "10,000 AI chats a month", "Human agent dispatch with reply-time targets", "Priority handover to multilingual agents", "10 team seats", "Weekly summary emails"],
  },
];

export default function PricingPlans() {
  const [yearly, setYearly] = useState(false);

  return (
    <div>
      <div className="mx-auto flex w-fit items-center gap-1 rounded-full border border-slate-200 bg-white p-1" role="group" aria-label="Billing period" data-testid="billing-toggle">
        {[
          { id: false, label: "Monthly" },
          { id: true, label: "Yearly" },
        ].map((o) => (
          <button
            key={o.label}
            type="button"
            aria-pressed={yearly === o.id}
            onClick={() => setYearly(o.id)}
            data-testid={`billing-${o.label.toLowerCase()}`}
            className={`rounded-full px-5 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 ${yearly === o.id ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}
          >
            {o.label}
            {o.id && <span className={`ml-1.5 text-xs ${yearly ? "text-cyan-100" : "text-emerald-600"}`}>save about 17%</span>}
          </button>
        ))}
      </div>
      <p role="status" aria-live="polite" data-testid="billing-summary" className="mt-3 text-center text-sm text-slate-500">
        Showing {yearly ? "yearly" : "monthly"} billing.
      </p>

      <ul className="mt-8 grid gap-6 lg:grid-cols-3">
        {PLANS.map((p) => {
          const per = yearly ? p.yearlyMonthly : p.monthly;
          return (
            <li key={p.id}>
              <article
                data-testid={`plan-${p.id}`}
                className={`relative flex h-full flex-col rounded-2xl border bg-white p-6 ${p.featured ? "border-indigo-500 shadow-lg shadow-indigo-100 ring-1 ring-indigo-500" : "border-slate-200"}`}
              >
                {p.featured && <span className="absolute -top-3 left-6 rounded-full bg-indigo-600 px-3 py-0.5 text-xs font-semibold text-white">Most popular</span>}
                <h2 className="font-heading text-xl font-semibold text-slate-900">{p.name}</h2>
                <p className="mt-1 text-sm text-slate-500">{p.tagline}</p>
                <p className="mt-5 flex items-baseline gap-1" data-testid={`plan-${p.id}-price`}>
                  {per === 0 ? (
                    <span className="font-heading text-4xl font-semibold text-slate-900">Free</span>
                  ) : (
                    <>
                      <Price usd={per} className="font-heading text-4xl font-semibold text-slate-900" />
                      <span className="text-sm text-slate-500">/ month</span>
                    </>
                  )}
                </p>
                <p className="mt-1 min-h-5 text-xs text-slate-500">
                  {per === 0 ? "No card needed." : yearly ? <>Billed <Price usd={per * 12} /> once a year.</> : "Billed monthly. Cancel any time."}
                </p>
                <ul className="mt-5 space-y-2.5 text-sm text-slate-700">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                      {f}
                    </li>
                  ))}
                </ul>
                <div className="mt-auto pt-7">
                  <Link
                    href="/sell"
                    data-testid={`plan-${p.id}-cta`}
                    className={`inline-flex w-full justify-center rounded-full px-5 py-2.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 ${p.featured ? "bg-indigo-600 text-white hover:bg-indigo-700" : "border border-slate-300 text-slate-800 hover:bg-slate-50"}`}
                  >
                    {p.monthly === 0 ? "Start free" : `Choose ${p.name}`}
                  </Link>
                </div>
              </article>
            </li>
          );
        })}
      </ul>

      <p data-testid="number-check-note" className="mx-auto mt-8 flex max-w-2xl items-start justify-center gap-2 text-center text-sm text-slate-600">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
        Every plan includes number-checked translation: prices, dates and quantities are verified by code before a message is sent.
      </p>
    </div>
  );
}
