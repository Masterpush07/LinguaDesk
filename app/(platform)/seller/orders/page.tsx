import OrdersManager from "@/components/platform/seller/OrdersManager";
import { PageHeading } from "@/components/platform/ui";

export const metadata = { title: "Orders · LinguaDesk Seller Studio" };

export default function SellerOrdersPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeading title="Orders" subtitle="Pack, ship and deliver confirmed orders. Courier and tracking details are entered by you. Customers are notified in the chat when an order ships or is delivered." />
      <OrdersManager />
    </div>
  );
}
