import SiteFooter from "@/components/platform/SiteFooter";
import { NotFoundPanel } from "@/components/platform/public/StorefrontView";
import PlatformLayout from "@/app/(platform)/layout";
import CustomerLayout from "@/app/(platform)/(customer)/layout";

export const metadata = { title: "Page not found · LinguaDesk" };

// Shown for any address that matches no page. It reuses the customer layout so the header, fonts and footer match the rest of the site.
export default function NotFound() {
  return (
    <PlatformLayout>
      <CustomerLayout>
        <main>
          <NotFoundPanel testId="not-found-page" title="This page could not be found" text="The link may be mistyped, or the page may have moved. Browse the marketplace to find shops and products." />
          <SiteFooter />
        </main>
      </CustomerLayout>
    </PlatformLayout>
  );
}
