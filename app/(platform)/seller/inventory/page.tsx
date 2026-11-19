import InventoryManager from "@/components/platform/seller/InventoryManager";
import { PageHeading } from "@/components/platform/ui";

export const metadata = { title: "Inventory · LinguaDesk Seller Studio" };

export default function InventoryPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeading title="Inventory" subtitle="Your products, prices and stock levels. Every change is saved immediately and is what customers and the AI see." />
      <InventoryManager />
    </div>
  );
}
