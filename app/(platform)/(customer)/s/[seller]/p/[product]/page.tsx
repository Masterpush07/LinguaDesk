import { Suspense } from "react";
import type { Metadata } from "next";
import SiteFooter from "@/components/platform/SiteFooter";
import DynamicMarker from "@/components/platform/public/DynamicMarker";
import ProductView from "@/components/platform/public/ProductView";
import { PageFallback } from "@/components/platform/ui";
import { clip } from "@/lib/site";
import { productMeta } from "@/lib/v2/public-data";

type Params = Promise<{ seller: string; product: string }>;

// The tab title and the preview shown when the product link is shared come from the product itself.
export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { seller, product } = await params;
  const item = await productMeta(seller, product).catch(() => null);
  if (!item) return { title: "Product · LinguaDesk" };
  const title = `${item.name} · ${item.shopName} · LinguaDesk`;
  const price = `USD ${item.priceUsd.toFixed(2)}`;
  const description = clip(item.description ? `${item.description} ${price}.` : `${item.name} from ${item.shopName}. ${price}.`);
  return {
    title,
    description,
    openGraph: { title, description, type: "website", siteName: "LinguaDesk", ...(item.imageUrl ? { images: [item.imageUrl] } : {}) },
    twitter: { card: item.imageUrl ? "summary_large_image" : "summary", title, description },
  };
}

export default function ProductPage({ params }: { params: Params }) {
  return (
    <main>
      <Suspense fallback={<PageFallback label="Loading product" />}>
        <Product params={params} />
      </Suspense>
      <SiteFooter />
      <DynamicMarker />
    </main>
  );
}

async function Product({ params }: { params: Params }) {
  const { seller, product } = await params;
  return <ProductView sellerSlug={seller} productId={product} />;
}
