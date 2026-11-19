import SettingsManager from "@/components/platform/seller/SettingsManager";
import { PageHeading } from "@/components/platform/ui";

export const metadata = { title: "Settings · LinguaDesk Seller Studio" };

export default function SellerSettingsPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeading title="Settings" subtitle="Your shop profile, languages, hours, shipping and policies. Select Save settings when you are done." />
      <SettingsManager />
    </div>
  );
}
