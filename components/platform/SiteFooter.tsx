import Link from "next/link";
import { Logo } from "@/components/platform/CustomerHeader";

export default function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-slate-200 bg-white" data-testid="site-footer">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <div className="flex flex-col gap-2">
          <Logo />
          <p>Sell to customers in any language. Built for the Nexconn Build Challenge 2026.</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <Link href="/pricing" className="hover:text-slate-900">Pricing</Link>
          <Link href="/sell" className="hover:text-slate-900">Sell on LinguaDesk</Link>
          <Link href="/demo" className="hover:text-slate-900">How it works</Link>
          <Link href="/marketplace" className="hover:text-slate-900">Marketplace</Link>
          <Link href="/privacy" className="hover:text-slate-900" data-testid="footer-privacy">Privacy</Link>
        </div>
      </div>
    </footer>
  );
}
