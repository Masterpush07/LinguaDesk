import Image from "next/image";
import Link from "next/link";
import QRCode from "qrcode";
import { ArrowRight, Headset, ShieldCheck, Store, ShoppingBag } from "lucide-react";
import SiteFooter from "@/components/platform/SiteFooter";
import { LANGS, MARKETPLACE_BANNER } from "@/lib/platform/data";

export const metadata = {
  title: "LinguaDesk - sell to customers in any language",
  description: "A multilingual marketplace for small shops. Customers write in their own language, the shop reads English, and every price and quantity is checked in code.",
};

const MARKETPLACE_URL = "https://lingua-desk-one.vercel.app/marketplace"; // what the QR code opens

const PATHS = [
  { icon: ShoppingBag, title: "Shop as a buyer", text: "Browse independent shops, ask questions in your own language and order with a card you can read.", href: "/marketplace", cta: "Browse shops", testId: "home-path-buyer" },
  { icon: Store, title: "Open a shop", text: "List products, add your FAQs and go live in four steps. Customers arrive in any language, you answer in English.", href: "/sell", cta: "Set up your shop", testId: "home-path-seller" },
  { icon: Headset, title: "Sign in to your desk", text: "Shop owners and agents: reply to translated conversations, manage orders and see your team's response times.", href: "/login", cta: "Sign in", testId: "home-path-signin" },
];

const STEPS = [
  { title: "Customer writes in their language", text: "No account needed. They open a shop link or scan a QR code and ask about prices, shipping or returns, by text or voice." },
  { title: "AI answers from the shop's own info", text: "It replies in the customer's language using only facts the shop provided, and hands over to a person when it is unsure." },
  { title: "The shop replies in English", text: "The agent reads an English translation, types in English, and the customer receives their own language." },
];

const SAFEGUARDS = [
  "Prices, dates and quantities are checked in code, so a wrong number is never sent to a customer.",
  "Orders, complaints and price negotiation always go to a person, not the AI.",
  "Every AI message is labelled, and the AI stops talking once an agent joins the chat.",
];

// Cached because the URL never changes; uncached async work would block prerendering the page.
async function marketplaceQr() {
  "use cache";
  return QRCode.toDataURL(MARKETPLACE_URL, { width: 220, margin: 1 });
}

const CTA_FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900";

// Front door of the product: says what it is in a few seconds and sends each kind of visitor to the right place.
export default async function HomePage() {
  const qr = await marketplaceQr();

  return (
    <main>
      <section className="relative isolate overflow-hidden bg-slate-900 text-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={MARKETPLACE_BANNER} alt="" className="absolute inset-0 -z-10 h-full w-full object-cover opacity-30" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-slate-950 via-slate-900/90 to-indigo-950/70" />
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <p className="inline-block rounded-full bg-white/10 px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-wide text-cyan-300 ring-1 ring-white/15">
            Multilingual marketplace for small shops
          </p>
          <h1 className="mt-4 max-w-3xl font-heading text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
            Sell to customers in any language, while you only write English.
          </h1>
          <p className="mt-4 max-w-2xl text-base text-slate-300 sm:text-lg">
            An AI assistant answers common questions instantly. When a person is needed, the shop steps in with translated, number-checked replies.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/marketplace" data-testid="home-hero-browse" className={`inline-flex items-center gap-2 rounded-full bg-indigo-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-indigo-400 motion-reduce:transition-none ${CTA_FOCUS}`}>
              Browse shops <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link href="/sell" data-testid="home-hero-sell" className={`rounded-full px-6 py-3 text-sm font-semibold text-white ring-1 ring-white/30 transition hover:bg-white/10 motion-reduce:transition-none ${CTA_FOCUS}`}>
              Open a shop
            </Link>
            <Link href="/demo" data-testid="home-hero-demo" className={`rounded-full px-6 py-3 text-sm font-semibold text-cyan-200 transition hover:bg-white/10 motion-reduce:transition-none ${CTA_FOCUS}`}>
              Watch the live demo
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8" aria-label="Choose how to start">
        <ul className="grid gap-4 md:grid-cols-3">
          {PATHS.map(({ icon: Icon, title, text, href, cta, testId }) => (
            <li key={href} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <h2 className="mt-4 font-heading text-lg font-semibold">{title}</h2>
              <p className="mt-1 flex-1 text-sm text-slate-600">{text}</p>
              <Link href={href} data-testid={testId} className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-600 hover:text-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
                {cta} <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="border-y border-slate-200 bg-white px-4 py-14 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <h2 className="font-heading text-2xl font-semibold tracking-tight">How it works</h2>
          <ol className="mt-6 grid gap-6 md:grid-cols-3">
            {STEPS.map((step, i) => (
              <li key={step.title} className="rounded-2xl bg-slate-50 p-5 ring-1 ring-slate-200">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-sm font-semibold text-white">{i + 1}</span>
                <h3 className="mt-3 font-heading font-semibold">{step.title}</h3>
                <p className="mt-1 text-sm text-slate-600">{step.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1fr_auto] lg:px-8">
        <div>
          <h2 className="flex items-center gap-2 font-heading text-2xl font-semibold tracking-tight">
            <ShieldCheck className="h-6 w-6 text-indigo-600" aria-hidden="true" />
            Built so the AI cannot cost a shop a sale
          </h2>
          <ul className="mt-4 space-y-3 text-slate-600">
            {SAFEGUARDS.map((item) => (
              <li key={item} className="flex gap-2">
                <span className="text-indigo-600" aria-hidden="true">&#10003;</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <p className="mt-8 text-sm font-medium text-slate-500">Works in {Object.keys(LANGS).length} languages</p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {Object.values(LANGS).map((l) => (
              <li key={l.code} dir="auto" className="rounded-full bg-indigo-50 px-3 py-1 text-sm text-indigo-700">
                {l.native}
              </li>
            ))}
          </ul>
        </div>
        <div className="text-center">
          {/* The code stays on white, because scanners need dark-on-light contrast. */}
          <div className="mx-auto inline-block rounded-2xl bg-white p-3 ring-1 ring-slate-200">
            <Image src={qr} alt="QR code that opens the LinguaDesk marketplace" width={200} height={200} unoptimized />
          </div>
          <p className="mt-3 text-sm text-slate-600">Scan to browse shops on your phone</p>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
