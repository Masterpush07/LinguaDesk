import type { ReactNode } from "react";
import CustomerHeader from "@/components/platform/CustomerHeader";
import { PrefsProvider } from "@/components/platform/Prefs";

export default function CustomerLayout({ children }: { children: ReactNode }) {
  return (
    <PrefsProvider>
      <div className="min-h-dvh bg-[#F8FAFC] text-slate-900">
        <CustomerHeader />
        {children}
      </div>
    </PrefsProvider>
  );
}
