import Link from "next/link";
import LiveDemo from "@/components/platform/growth/LiveDemo";
import NumberGuardDemo from "@/components/platform/growth/NumberGuardDemo";

export const metadata = { title: "Guided walkthrough · LinguaDesk" };

export default function DemoPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-6 max-w-3xl">
        <p className="inline-block rounded-full bg-cyan-50 px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-wide text-cyan-700 ring-1 ring-cyan-200">Guided walkthrough</p>
        <h1 className="mt-3 font-heading text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">One conversation, two screens</h1>
        <p className="mt-2 text-slate-600">On the left, a customer writes in their own language. On the right, the shop&apos;s agent desk shows the same conversation in English. Step through it manually or select auto-play. This is a scripted example; browse a shop to chat with a real team.</p>
      </div>
      <LiveDemo />
      <NumberGuardDemo />
      <p className="mt-6 text-center text-sm text-slate-600">
        Interested in this for your shop?{" "}
        <Link href="/sell" data-testid="demo-sell-link" className="font-medium text-indigo-600 underline underline-offset-2 hover:text-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">Set up your shop</Link>
      </p>
    </main>
  );
}
