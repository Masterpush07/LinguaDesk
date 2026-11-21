import { Suspense } from "react";
import RecoverForm from "@/components/platform/auth/RecoverForm";
import SiteFooter from "@/components/platform/SiteFooter";
import { PageFallback } from "@/components/platform/ui";

export const metadata = { title: "Reset your passcode · LinguaDesk" };

export default function RecoverPage() {
  return (
    <main>
      <Suspense fallback={<PageFallback label="Loading passcode reset" />}>
        <RecoverForm />
      </Suspense>
      <SiteFooter />
    </main>
  );
}
