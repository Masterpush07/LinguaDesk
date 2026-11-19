import type { Metadata } from "next";
import DispatchBoard from "@/components/platform/agent/DispatchBoard";
import RequireDeskStaff from "@/components/platform/agent/RequireDeskStaff";

export const metadata: Metadata = { title: "Dispatch · LinguaDesk Agent" };

export default function DispatchPage() {
  return (
    <RequireDeskStaff>
      <DispatchBoard />
    </RequireDeskStaff>
  );
}
