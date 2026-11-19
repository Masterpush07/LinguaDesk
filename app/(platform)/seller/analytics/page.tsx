import AnalyticsView from "@/components/platform/seller/AnalyticsView";
import { PageHeading } from "@/components/platform/ui";

export const metadata = { title: "Performance · LinguaDesk Seller Studio" };

export default function AnalyticsPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeading title="Performance" subtitle="How your conversations turn into orders, and how quickly your team responds." />
      <AnalyticsView theme="light" />
    </div>
  );
}
