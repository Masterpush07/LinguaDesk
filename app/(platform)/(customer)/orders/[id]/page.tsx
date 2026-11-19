import type { Metadata } from "next";
import { Suspense } from "react";
import SiteFooter from "@/components/platform/SiteFooter";
import BuyerOrderDetail from "@/components/platform/orders/BuyerOrderDetail";
import { NextAction, PageFallback } from "@/components/platform/ui";

export const metadata: Metadata = { title: "Order | LinguaDesk" };

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <main>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Suspense fallback={<PageFallback label="Loading order" />}>
          <OrderContent params={params} />
        </Suspense>
        <div className="mt-10">
          <NextAction title="Back to your orders" text="View the status of your other orders." href="/orders" cta="My orders" />
        </div>
      </div>
      <SiteFooter />
    </main>
  );
}

async function OrderContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <BuyerOrderDetail id={id} />;
}
