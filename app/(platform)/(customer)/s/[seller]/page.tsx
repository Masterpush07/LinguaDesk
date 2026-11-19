import { Suspense } from "react";
import SiteFooter from "@/components/platform/SiteFooter";
import StorefrontView from "@/components/platform/public/StorefrontView";
import { PageFallback } from "@/components/platform/ui";

export const metadata = { title: "Shop · LinguaDesk" };

export default function StorefrontPage({ params }: { params: Promise<{ seller: string }> }) {
  return (
    <main>
      <Suspense fallback={<PageFallback label="Loading shop" />}>
        <Storefront params={params} />
      </Suspense>
      <SiteFooter />
    </main>
  );
}

async function Storefront({ params }: { params: Promise<{ seller: string }> }) {
  const { seller } = await params;
  return <StorefrontView slug={seller} />;
}
