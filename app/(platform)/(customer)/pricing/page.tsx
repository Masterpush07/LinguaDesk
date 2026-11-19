import Link from "next/link";
import { ChevronDown, Info } from "lucide-react";
import PricingPlans from "@/components/platform/growth/PricingPlans";
import SiteFooter from "@/components/platform/SiteFooter";

export const metadata = { title: "Pricing · LinguaDesk" };

const FAQ = [
  { id: "who-pays", q: "Who pays: the seller or the buyer?",   a: "The seller pays for the plan. Buyers never pay to start a conversation, translate their messages or hear a reply read aloud." },
    { id: "translation-billing", q: "How is translation billed?", a: "Each plan includes a monthly allowance of AI conversations. A conversation counts once, regardless of how many messages it contains, and replies written by a human agent are never counted as AI conversations." },
    { id: "free-tier", q: "Is there a free plan?", a: "Yes. Starter is free with no time limit and includes 100 AI conversations a month. If you exceed that allowance, additional conversations are routed to you instead of incurring unexpected charges." },
    { id: "change-plan", q: "Can I change plans later?", a: "Yes. You can move up or down at any time. Your shop, products and knowledge base remain unchanged." },
];

export default function PricingPage() {
  return (
    <main>
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p data-testid="illustrative-label" className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-200">
            <Info className="h-3.5 w-3.5" aria-hidden="true" />
            Illustrative pricing for the prototype
          </p>
          <h1 className="mt-4 font-heading text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">Simple plans that grow with your shop</h1>
          <p className="mt-3 text-base text-slate-600 sm:text-lg">These figures show how pricing could work. No charges apply in this prototype and no payment card is required.</p>
        </div>

        <div className="mt-10">
          <PricingPlans />
        </div>

        <section aria-labelledby="pricing-faq" className="mx-auto mt-16 max-w-3xl">
          <h2 id="pricing-faq" className="font-heading text-2xl font-semibold text-slate-900">Pricing questions</h2>
          <div className="mt-4 space-y-3" data-testid="pricing-faq">
            {FAQ.map((f) => (
              <details key={f.id} data-testid={`faq-${f.id}`} className="group rounded-2xl border border-slate-200 bg-white p-5 open:shadow-sm">
                <summary data-testid={`faq-toggle-${f.id}`} className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg font-medium text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-open:rotate-180 motion-reduce:transition-none" aria-hidden="true" />
                </summary>
                <p className="mt-3 text-sm text-slate-600">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="mx-auto mt-16 max-w-3xl rounded-2xl bg-gradient-to-r from-indigo-600 via-violet-600 to-cyan-600 p-8 text-center text-white" data-testid="pricing-cta">
          <h2 className="font-heading text-2xl font-semibold">Ready to sell in every language?</h2>
          <p className="mt-2 text-indigo-100">Set up your shop in about five minutes. New shops start on the free plan.</p>
          <Link href="/sell" data-testid="pricing-cta-link" className="mt-5 inline-flex rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-indigo-600">
            Start selling
          </Link>
        </section>
      </div>
      <SiteFooter />
    </main>
  );
}
