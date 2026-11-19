import type { Metadata } from "next";
import SiteFooter from "@/components/platform/SiteFooter";
import BuyerOrders from "@/components/platform/orders/BuyerOrders";
import { NextAction, PageHeading } from "@/components/platform/ui";

export const metadata: Metadata = { title: "My orders | LinguaDesk" };

export default function OrdersPage() {
  return (
    <main>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <PageHeading title="My orders" subtitle="Orders you confirmed in a conversation. Open an order to see its status and contact the shop." />
        <BuyerOrders />
        <div className="mt-10">
          <NextAction title="Looking for something new?" text="Browse shops from around the world and ask questions in your own language." href="/marketplace" cta="Discover shops" />
        </div>
      </div>
      <SiteFooter />
    </main>
  );
}
