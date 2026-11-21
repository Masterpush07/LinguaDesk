import ReturnsManager from "@/components/platform/seller/ReturnsManager";
import { PageHeading } from "@/components/platform/ui";

export const metadata = { title: "Returns · LinguaDesk Seller Studio" };

export default function SellerReturnsPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeading title="Returns" subtitle="Review return requests for delivered orders. Approve or reject each request and add a note. The customer is told in the conversation and by notification." />
      <ReturnsManager />
    </div>
  );
}
