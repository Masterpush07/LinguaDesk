import { Suspense } from "react";
import SiteFooter from "@/components/platform/SiteFooter";
import ProductView from "@/components/platform/public/ProductView";
import { PageFallback } from "@/components/platform/ui";

export const metadata = { title: "Product · LinguaDesk" };

type Params = Promise<{ seller: string; product: string }>;

export default function ProductPage({ params }: { params: Params }) {
  return (
    <main>
      <Suspense fallback={<PageFallback label="Loading product" />}>
        <Product params={params} />
      </Suspense>
      <SiteFooter />
    </main>
  );
}

async function Product({ params }: { params: Params }) {
  const { seller, product } = await params;
  return <ProductView sellerSlug={seller} productId={product} />;
}
