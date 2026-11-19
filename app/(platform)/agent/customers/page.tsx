import type { Metadata } from "next";
import CustomerDirectory from "@/components/platform/agent/CustomerDirectory";
import RequireDeskStaff from "@/components/platform/agent/RequireDeskStaff";

export const metadata: Metadata = { title: "Customers · LinguaDesk Agent" };

export default function CustomersPage() {
  return (
    <RequireDeskStaff>
      <CustomerDirectory />
    </RequireDeskStaff>
  );
}
