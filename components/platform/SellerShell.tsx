"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { BarChart3, BookOpen, Boxes, Headset, Languages, LayoutDashboard, LogOut, Package, Settings, Store, Undo2, Users } from "lucide-react";
import { signOut as signOutRequest } from "@/components/platform/auth/session";
import { Logo } from "@/components/platform/CustomerHeader";
import { LoadingBlock } from "@/components/platform/seller/ui";
import NotificationBell from "@/components/platform/NotificationBell";
import { useHeartbeat, useStaff } from "@/lib/v2/client";

const NAV = [
  { href: "/seller", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/seller/inventory", label: "Inventory", icon: Boxes },
  { href: "/seller/orders", label: "Orders", icon: Package },
  { href: "/seller/returns", label: "Returns", icon: Undo2 },
  { href: "/seller/glossary", label: "AI glossary", icon: Languages },
  { href: "/seller/knowledge", label: "Knowledge base", icon: BookOpen },
  { href: "/seller/team", label: "Team", icon: Users },
  { href: "/seller/analytics", label: "Performance", icon: BarChart3 },
  { href: "/seller/settings", label: "Settings", icon: Settings },
];

const HEADER_LINK =
  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs font-medium text-slate-200 transition motion-reduce:transition-none hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400";

// Seller studio: slate header, left navigation, light content area. Only the shop owner can open it.
export default function SellerShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const staff = useStaff({ owner: true });
  useHeartbeat(staff !== null);
  const [signOutError, setSignOutError] = useState("");

  const signOut = async () => {
    setSignOutError("");
    const failure = await signOutRequest();
    if (failure) setSignOutError(failure);
  };

  return (
    <div className="flex min-h-dvh flex-col bg-slate-50 text-slate-900" data-testid="seller-shell">
      <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 bg-slate-900 px-4 text-white">
        <Logo dark />
        <span className="hidden whitespace-nowrap rounded-md bg-slate-800 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-slate-300 sm:inline">Seller Studio</span>
        {staff && (
          <p className="ml-2 hidden min-w-0 truncate text-xs text-slate-300 md:block" data-testid="seller-account">
            <span className="font-semibold text-white" data-testid="seller-shop-name">{staff.sellerName}</span>
            <span aria-hidden="true"> · </span>
            <span data-testid="seller-owner-name">{staff.name}</span>
          </p>
        )}
        <div className="ml-auto flex items-center gap-1">
          {staff && (
            <>
              <NotificationBell />
              <Link href="/agent" data-testid="seller-open-agent-desk" className={HEADER_LINK}>
                <Headset className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">Open inbox</span>
              </Link>
              <Link href={`/s/${staff.sellerSlug}`} data-testid="seller-view-storefront" className={HEADER_LINK}>
                <Store className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">View storefront</span>
              </Link>
            </>
          )}
          <button type="button" onClick={signOut} data-testid="seller-sign-out" className={HEADER_LINK}>
            <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">Sign out</span>
          </button>
        </div>
      </header>
      {signOutError && (
        <p role="alert" data-testid="seller-sign-out-error" className="bg-red-50 px-4 py-2 text-sm text-red-700">
          {signOutError}
        </p>
      )}
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <nav aria-label="Seller" className="flex shrink-0 gap-1 overflow-x-auto border-b border-slate-200 bg-white p-3 md:w-64 md:flex-col md:overflow-visible md:border-b-0 md:border-r md:p-4">
          {NAV.map(({ href, label, icon: Icon, exact }) => {
            const active = exact ? pathname === href : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                data-testid={`seller-nav-${label.toLowerCase().replace(/\s+/g, "-")}`}
                className={`flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${active ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"}`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {label}
              </Link>
            );
          })}
        </nav>
        <main className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {!staff && <LoadingBlock label="Loading your seller studio" testId="seller-shell-loading" />}
          {/* Rendered while the session loads, but hidden and inert, so signed-out visitors never see data screens. */}
          <div className={staff ? undefined : "invisible h-0 overflow-hidden"} inert={!staff}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
