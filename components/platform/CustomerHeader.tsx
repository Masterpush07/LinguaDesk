"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Globe2, LogOut } from "lucide-react";
import { deskPath, signOut, useCurrentStaff } from "@/components/platform/auth/session";
import { usePrefs } from "@/components/platform/Prefs";
import { useUnreadCount } from "@/components/platform/chat/useUnread";
import { CURRENCIES, LANGS } from "@/lib/platform/data";
import type { Currency, LangCode } from "@/lib/platform/types";

const PRIMARY = [
  { href: "/marketplace", label: "Discover" },
  { href: "/chats", label: "Conversations" },
  { href: "/orders", label: "Orders" },
];
const SECONDARY = [
  { href: "/sell", label: "For sellers" },
  { href: "/pricing", label: "Pricing" },
  { href: "/demo", label: "Live demo" },
];

const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500";
const SELECT = `h-9 shrink-0 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 ${FOCUS}`;

export function Logo({ dark = false }: { dark?: boolean }) {
  return (
    <Link href="/" className="flex shrink-0 items-center gap-2" data-testid="logo">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 via-indigo-600 to-cyan-500 text-white shadow-sm">
        <Globe2 className="h-4.5 w-4.5" aria-hidden="true" />
      </span>
      <span className={`font-heading text-lg font-semibold tracking-tight ${dark ? "text-white" : "text-slate-900"}`}>LinguaDesk</span>
    </Link>
  );
}

function NavLink({ href, label, pathname, mobile = false, badge = 0 }: { href: string; label: string; pathname: string; mobile?: boolean; badge?: number }) {
  const active = pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      data-testid={`${mobile ? "mobile-" : ""}nav-${label.toLowerCase().replace(/\s+/g, "-")}`}
      className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition motion-reduce:transition-none ${FOCUS} ${
        active ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
      }`}
    >
      {label}
      {badge > 0 && (
        <span data-testid={`${mobile ? "mobile-" : ""}nav-${label.toLowerCase()}-unread`} className="ml-1.5 inline-flex min-w-5 items-center justify-center rounded-full bg-indigo-600 px-1.5 text-[11px] font-semibold leading-5 text-white">
          <span aria-hidden="true">{badge > 9 ? "9+" : badge}</span>
          <span className="sr-only">{badge} unread {badge === 1 ? "message" : "messages"}</span>
        </span>
      )}
    </Link>
  );
}

function AuthControl() {
  const me = useCurrentStaff();

  if (me === undefined) return <span className="h-9 w-24 animate-pulse rounded-full bg-slate-100 motion-reduce:animate-none" aria-hidden="true" data-testid="auth-loading" />;

  if (me) {
    return (
      <>
        <Link
          href={deskPath(me.role)}
          data-testid="nav-open-desk"
          className={`shrink-0 whitespace-nowrap rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 motion-reduce:transition-none ${FOCUS} focus-visible:ring-offset-2`}
        >
          Open desk
        </Link>
        <button
          type="button"
          onClick={() => void signOut()}
          data-testid="nav-sign-out"
          aria-label="Sign out"
          title={`Signed in as ${me.name} of ${me.sellerName}`}
          className={`flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 motion-reduce:transition-none ${FOCUS}`}
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          <span className="hidden lg:inline">Sign out</span>
        </button>
      </>
    );
  }

  return (
    <>
      <Link
        href="/login"
        data-testid="nav-sign-in"
        className={`shrink-0 whitespace-nowrap rounded-full px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 hover:text-slate-900 motion-reduce:transition-none ${FOCUS}`}
      >
        Sign in
      </Link>
      <Link
        href="/sell"
        data-testid="nav-open-shop"
        className={`hidden shrink-0 whitespace-nowrap rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 motion-reduce:transition-none sm:block ${FOCUS} focus-visible:ring-offset-2`}
      >
        Open a shop
      </Link>
    </>
  );
}

// usePathname() on a dynamic route needs a Suspense boundary; until it resolves, links render without the active highlight.
function NavLinks({ pathname, mobile = false, unread = 0 }: { pathname: string; mobile?: boolean; unread?: number }) {
  return (
    <>
      {PRIMARY.map((item) => (
        <NavLink key={item.href} {...item} pathname={pathname} mobile={mobile} badge={item.href === "/chats" ? unread : 0} />
      ))}
      {!mobile && <span className="mx-2 h-5 w-px bg-slate-200" aria-hidden="true" />}
      {SECONDARY.map((item) => (
        <NavLink key={item.href} {...item} pathname={pathname} mobile={mobile} />
      ))}
    </>
  );
}

function ActiveNavLinks({ mobile = false, unread = 0 }: { mobile?: boolean; unread?: number }) {
  return <NavLinks pathname={usePathname()} mobile={mobile} unread={unread} />;
}

// Sticky header for every customer-facing page. Full navigation shows from 1280px; narrower screens use the second row.
export default function CustomerHeader() {
  const { language, setLanguage, currency, setCurrency } = usePrefs();
  const unread = useUnreadCount();

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/85 backdrop-blur-xl" data-testid="customer-header">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
        <Logo />
        <nav aria-label="Main" className="ml-2 hidden min-w-0 items-center gap-0.5 xl:flex">
          <Suspense fallback={<NavLinks pathname="" unread={unread} />}>
            <ActiveNavLinks unread={unread} />
          </Suspense>
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <label className="sr-only" htmlFor="lang-select">
            Your language
          </label>
          <select
            id="lang-select"
            data-testid="language-select"
            className={`${SELECT} hidden md:block`}
            value={language}
            onChange={(e) => setLanguage(e.target.value as LangCode)}
          >
            {Object.values(LANGS).map((l) => (
              <option key={l.code} value={l.code}>
                {l.native}
              </option>
            ))}
          </select>
          <label className="sr-only" htmlFor="currency-select">
            Currency
          </label>
          <select id="currency-select" data-testid="currency-select" className={SELECT} value={currency} onChange={(e) => setCurrency(e.target.value as Currency)}>
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} {c.symbol.trim()}
              </option>
            ))}
          </select>
          <span className="mx-1 hidden h-5 w-px bg-slate-200 sm:block" aria-hidden="true" />
          <AuthControl />
        </div>
      </div>
      <nav aria-label="Main (mobile)" className="flex gap-1 overflow-x-auto border-t border-slate-100 px-3 py-1.5 sm:px-6 xl:hidden">
        <Suspense fallback={<NavLinks pathname="" mobile unread={unread} />}>
          <ActiveNavLinks mobile unread={unread} />
        </Suspense>
      </nav>
    </header>
  );
}
