import type { Metadata } from "next";
import SiteFooter from "@/components/platform/SiteFooter";
import ProfileForm from "@/components/platform/orders/ProfileForm";
import { PageHeading } from "@/components/platform/ui";

export const metadata: Metadata = { title: "Profile | LinguaDesk" };

export default function ProfilePage() {
  return (
    <main>
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <PageHeading title="Your profile" subtitle="Choose your language and currency. No account is required to shop." />
        <ProfileForm />
      </div>
      <SiteFooter />
    </main>
  );
}
