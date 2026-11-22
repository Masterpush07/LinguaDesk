import { Suspense } from "react";
import type { Metadata } from "next";
import SiteFooter from "@/components/platform/SiteFooter";
import DynamicMarker from "@/components/platform/public/DynamicMarker";
import ProductView from "@/components/platform/public/ProductView";
import { PageFallback } from "@/components/platform/ui";
import { productMeta } from "@/lib/v2/public-data";
import { productMetadata } from "@/lib/v2/seo-metadata";

type Params = Promise<{ seller: string; product: string }>;

// The tab title and the preview shown when the product link is shared come from the product itself.
export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { seller, product } = await params;
  const item = await productMeta(seller, product).catch(() => null);
  if (!item) return { title: "Product · LinguaDesk" };
  return productMetadata(item);
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
