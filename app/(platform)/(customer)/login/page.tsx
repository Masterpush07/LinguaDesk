import { Suspense } from "react";
import LoginScreen from "@/components/platform/auth/LoginScreen";
import SiteFooter from "@/components/platform/SiteFooter";
import { PageFallback } from "@/components/platform/ui";

export const metadata = { title: "Sign in · LinguaDesk" };

export default function LoginPage() {
  return (
    <main>
      <Suspense fallback={<PageFallback label="Loading sign in" />}>
        <LoginScreen initialTab="signin" />
      </Suspense>
      <SiteFooter />
    </main>
  );
}
