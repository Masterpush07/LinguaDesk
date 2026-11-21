import type { Metadata } from "next";
import Link from "next/link";
import SiteFooter from "@/components/platform/SiteFooter";
import ProfileForm from "@/components/platform/orders/ProfileForm";
import { PageHeading } from "@/components/platform/ui";

export const metadata: Metadata = { title: "Profile | LinguaDesk" };

export default function ProfilePage() {
  return (
    <main>
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <PageHeading title="Your profile" subtitle="Choose your language and currency, keep your conversations, and manage alerts. No account is required to shop." />
        <ProfileForm />
        <p className="mt-6 text-sm text-slate-600">
          Want a copy of your data, or to delete it? See <Link href="/privacy" className="font-medium text-indigo-700 underline underline-offset-2">your privacy choices</Link>.
        </p>
      </div>
      <SiteFooter />
    </main>
  );
}
