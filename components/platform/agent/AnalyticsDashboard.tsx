"use client";

import AnalyticsView from "@/components/platform/seller/AnalyticsView";

// Dark analytics screen for the agent desk. Reads the same real data as the seller's Performance page.
export default function AnalyticsDashboard() {
  return (
    <div className="h-full overflow-y-auto bg-[#0B0F17]" data-testid="analytics-dashboard">
      <div className="mx-auto max-w-7xl space-y-5 p-4 sm:p-6">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight text-slate-100">Analytics</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">How the desk is performing, calculated from stored conversations and orders.</p>
        </div>
        <AnalyticsView theme="dark" />
      </div>
    </div>
  );
}
