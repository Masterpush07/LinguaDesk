import type { Metadata } from "next";
import AnalyticsDashboard from "@/components/platform/agent/AnalyticsDashboard";

export const metadata: Metadata = { title: "Analytics · LinguaDesk Agent" };

export default function AnalyticsPage() {
  return <AnalyticsDashboard />;
}
