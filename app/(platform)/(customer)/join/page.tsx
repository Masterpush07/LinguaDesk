import { Suspense } from "react";
import LoginScreen from "@/components/platform/auth/LoginScreen";
import SiteFooter from "@/components/platform/SiteFooter";
import { PageFallback } from "@/components/platform/ui";

export const metadata = { title: "Join a team · LinguaDesk" };

export default function JoinPage() {
  return (
    <main>
      <Suspense fallback={<PageFallback label="Loading" />}>
        <LoginScreen initialTab="join" />
      </Suspense>
      <SiteFooter />
    </main>
  );
}
