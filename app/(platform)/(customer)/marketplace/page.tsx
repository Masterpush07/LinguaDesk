import Link from "next/link";
import { ArrowRight, Languages, Mic, ShieldCheck } from "lucide-react";
import MarketplaceBrowser from "@/components/platform/MarketplaceBrowser";
import SiteFooter from "@/components/platform/SiteFooter";
import { MARKETPLACE_BANNER } from "@/lib/platform/data";

export const metadata = { title: "Marketplace · LinguaDesk" };

const PERKS = [
  { icon: Languages, title: "Chat in your language", text: "Write or speak in any of 10 languages. The shop reads English, and you read yours." },
  { icon: ShieldCheck, title: "Numbers always checked", text: "Prices, dates and quantities are verified in code, not trusted to the AI." },
  { icon: Mic, title: "Voice messages", text: "Record a voice message and review the translation before it is sent." },
];

export default function MarketplacePage() {
  return (
    <main>
      <section className="relative isolate overflow-hidden bg-slate-900 text-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={MARKETPLACE_BANNER} alt="" className="absolute inset-0 -z-10 h-full w-full object-cover opacity-30" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-slate-950 via-slate-900/90 to-indigo-950/70" />
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <p className="inline-block rounded-full bg-white/10 px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-wide text-cyan-300 ring-1 ring-white/15">
            Global discovery
          </p>
          <h1 className="mt-4 max-w-2xl font-heading text-4xl font-semibold tracking-tight sm:text-5xl">Shop with makers from around the world, in your own language.</h1>
          <p className="mt-4 max-w-xl text-base text-slate-300 sm:text-lg">Ask a question and receive an answer you can read. AI handles the translation, and agents and shop staff handle your order.</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="#marketplace-browse" data-testid="hero-browse" className="inline-flex items-center gap-2 rounded-full bg-indigo-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-400 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900">
              Browse shops <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link href="/sell" data-testid="hero-open-shop" className="rounded-full px-5 py-2.5 text-sm font-semibold text-white ring-1 ring-white/30 transition hover:bg-white/10 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">
              Open a shop
            </Link>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <ul className="mb-10 grid gap-4 sm:grid-cols-3">
          {PERKS.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                <Icon className="h-4.5 w-4.5" aria-hidden="true" />
              </span>
              <div>
                <p className="font-heading text-sm font-semibold">{title}</p>
                <p className="mt-0.5 text-sm text-slate-500">{text}</p>
              </div>
            </li>
          ))}
        </ul>
        <div id="marketplace-browse" className="scroll-mt-24">
          <MarketplaceBrowser />
        </div>
      </div>
      <SiteFooter />
    </main>
  );
}
