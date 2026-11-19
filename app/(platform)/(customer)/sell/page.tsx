import Link from "next/link";
import SellWizard from "@/components/platform/growth/SellWizard";
import SiteFooter from "@/components/platform/SiteFooter";

export const metadata = { title: "Sell on LinguaDesk" };

export default function SellPage() {
  return (
    <main>
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto mb-8 max-w-2xl text-center">
          <p className="inline-block rounded-full bg-indigo-50 px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-wide text-indigo-700 ring-1 ring-indigo-200">For shop owners</p>
          <h1 className="mt-4 font-heading text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">Open your shop to the world in four steps</h1>
          <p className="mt-3 text-base text-slate-600 sm:text-lg">No technical skills are required. Customers write in their own language and you read English. See <Link href="/pricing" data-testid="sell-pricing-link" className="font-medium text-indigo-600 underline underline-offset-2 hover:text-indigo-700">pricing</Link> or <Link href="/demo" data-testid="sell-demo-link" className="font-medium text-indigo-600 underline underline-offset-2 hover:text-indigo-700">view the live demo</Link>.</p>
        </div>
        <SellWizard />
      </div>
      <SiteFooter />
    </main>
  );
}
