import { Suspense } from "react";
import type { Metadata } from "next";
import SiteFooter from "@/components/platform/SiteFooter";
import DynamicMarker from "@/components/platform/public/DynamicMarker";
import StorefrontView from "@/components/platform/public/StorefrontView";
import { PageFallback } from "@/components/platform/ui";
import { clip } from "@/lib/site";
import { shopMeta } from "@/lib/v2/public-data";

type Params = Promise<{ seller: string }>;

// The tab title and the preview shown when the shop link is shared come from the shop itself.
export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { seller } = await params;
  const shop = await shopMeta(seller).catch(() => null);
  if (!shop) return { title: "Shop · LinguaDesk" };
  const title = `${shop.name} · LinguaDesk`;
  const description = clip(shop.text || `A shop in ${shop.country} on LinguaDesk. Ask your questions in your own language.`);
  return {
    title,
    description,
    openGraph: { title, description, type: "website", siteName: "LinguaDesk", ...(shop.imageUrl ? { images: [shop.imageUrl] } : {}) },
    twitter: { card: shop.imageUrl ? "summary_large_image" : "summary", title, description },
  };
}

export default function StorefrontPage({ params }: { params: Params }) {
  return (
    <main>
      <Suspense fallback={<PageFallback label="Loading shop" />}>
        <Storefront params={params} />
      </Suspense>
      <SiteFooter />
      <DynamicMarker />
    </main>
  );
}

async function Storefront({ params }: { params: Params }) {
  const { seller } = await params;
  return <StorefrontView slug={seller} />;
}
