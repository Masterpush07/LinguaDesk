"use client";

import { useState } from "react";
import { CheckCircle2, ShieldAlert, ShieldCheck } from "lucide-react";
import { extractNumbers, numberIssue, sameNumbers } from "@/lib/number-check";

// Runs the product's real number checks in the browser. The sentences are written examples; in the product the AI writes the translation or the answer,
// and these same functions decide, in code, whether it may reach the other person.
const SHOP_INFO = "Silk scarf: $40. In stock. Brass lamp: $12.50. In stock. Shipping is free above $50, otherwise $6. Delivery takes 7 days.";
const ENGLISH = "The silk scarf is $40 and delivery takes 7 days.";
const TRANSLATIONS = [
  { label: "Faithful", text: "La bufanda de seda cuesta 40 $ y la entrega tarda 7 días." },
  { label: "Price changed", text: "La bufanda de seda cuesta 45 $ y la entrega tarda 7 días." },
  { label: "Quantity dropped", text: "La bufanda de seda cuesta 40 $ y la entrega tarda unos días." },
  { label: "Number in words (same number)", text: "La bufanda de seda cuesta 40 $ y la entrega tarda siete días." },
];
const ANSWERS = [
  { label: "From the shop info", text: "The brass lamp costs $12.50 and shipping is free above $50." },
  { label: "Invented price", text: "The brass lamp costs $15." },
  { label: "Made-up stock", text: "We have only 3 brass lamps left." },
  { label: "Converted currency", text: "The silk scarf costs about ₹3,300." },
];

function Verdict({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <p role="status" data-testid={ok ? "guard-pass" : "guard-block"} className={`mt-3 flex items-start gap-2 rounded-xl px-3 py-2 text-sm font-medium ${ok ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200" : "bg-amber-50 text-amber-900 ring-1 ring-amber-200"}`}>
      {ok ? <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> : <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />}
      <span>{children}</span>
    </p>
  );
}

const chip = (active: boolean) =>
  `rounded-full border px-3 py-1.5 text-sm font-medium transition motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${active ? "border-indigo-600 bg-indigo-50 text-indigo-700" : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"}`;

export default function NumberGuardDemo() {
  const [translation, setTranslation] = useState(TRANSLATIONS[1].text);
  const [answer, setAnswer] = useState(ANSWERS[1].text);
  const translationOk = sameNumbers(ENGLISH, translation);
  const issue = numberIssue(answer, SHOP_INFO);

  return (
    <section aria-labelledby="guard-title" data-testid="number-guard-demo" className="mt-12 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 id="guard-title" className="font-heading text-xl font-semibold text-slate-900">Try to change a price</h2>
      <p className="mt-1 max-w-3xl text-sm text-slate-600">
        Translation and AI answers can silently alter a price or a quantity. In LinguaDesk every number is checked in code before a message is sent, and nothing is sent if one changed.
        This panel runs that same check. Edit any text and watch the verdict.
      </p>

      <div className="mt-5 grid gap-6 lg:grid-cols-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">1. The shop&apos;s reply, translated for the customer</h3>
          <p className="mt-2 text-sm text-slate-700"><span className="font-medium">Written in English:</span> {ENGLISH}</p>
          <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Example translations">
            {TRANSLATIONS.map((t) => (
              <button key={t.label} type="button" onClick={() => setTranslation(t.text)} aria-pressed={translation === t.text} className={chip(translation === t.text)}>{t.label}</button>
            ))}
          </div>
          <label htmlFor="guard-translation" className="mt-3 block text-sm font-medium text-slate-900">Translation the customer would receive</label>
          <textarea id="guard-translation" value={translation} onChange={(e) => setTranslation(e.target.value)} rows={3} data-testid="guard-translation" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900" />
          <p className="mt-1 text-xs text-slate-500" data-testid="guard-translation-numbers">Numbers read: {extractNumbers(ENGLISH).join(", ") || "none"} → {extractNumbers(translation).join(", ") || "none"}</p>
          {translationOk ? <Verdict ok>Numbers match. This translation can be sent.</Verdict> : <Verdict ok={false}>A number changed or went missing. Nothing is sent; the shop rewords it or sends the original English.</Verdict>}
        </div>

        <div>
          <h3 className="text-sm font-semibold text-slate-900">2. An AI answer to a customer question</h3>
          <p className="mt-2 text-sm text-slate-700"><span className="font-medium">Shop information the AI may use:</span> {SHOP_INFO}</p>
          <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Example answers">
            {ANSWERS.map((a) => (
              <button key={a.label} type="button" onClick={() => setAnswer(a.text)} aria-pressed={answer === a.text} className={chip(answer === a.text)}>{a.label}</button>
            ))}
          </div>
          <label htmlFor="guard-answer" className="mt-3 block text-sm font-medium text-slate-900">AI answer</label>
          <textarea id="guard-answer" value={answer} onChange={(e) => setAnswer(e.target.value)} rows={3} data-testid="guard-answer" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900" />
          {issue === null ? <Verdict ok>Every number and price is in the shop information. This answer can be sent.</Verdict> : <Verdict ok={false}>Blocked: {issue}. The customer gets &quot;the team has been notified&quot; and a person answers.</Verdict>}
        </div>
      </div>
      <p className="mt-4 flex items-start gap-2 text-xs text-slate-500">
        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        Covers digits in any script, decimals and thousands as written in different countries, currency amounts, English number words, and one to ten in Spanish, French, German, Italian, Portuguese and Hindi. It does not cover every language&apos;s number words.
      </p>
    </section>
  );
}
