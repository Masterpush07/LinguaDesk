import type { Metadata } from "next";
import { Suspense } from "react";
import Inbox from "@/components/platform/agent/Inbox";
import { Loading } from "@/components/platform/agent/desk-ui";
import RequireDeskStaff from "@/components/platform/agent/RequireDeskStaff";

export const metadata: Metadata = { title: "Inbox · LinguaDesk Agent" };

// The inbox reads ?thread= from the URL, so it needs a Suspense boundary.
export default function AgentInboxPage() {
  return (
    <Suspense fallback={<Loading label="Loading the inbox" testId="agent-inbox-loading" />}>
      <RequireDeskStaff>
        <Inbox />
      </RequireDeskStaff>
    </Suspense>
  );
}
