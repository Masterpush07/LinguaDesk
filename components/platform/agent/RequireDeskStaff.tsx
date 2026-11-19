"use client";

import { useContext, type ReactNode } from "react";
import { Loading } from "@/components/platform/agent/desk-ui";
import { DeskContext } from "@/lib/v2/desk-client";

// Renders the desk screen once the shell knows who is signed in. The shell always renders its children, so the page stays part of the static shell.
export default function RequireDeskStaff({ children }: { children: ReactNode }) {
  const staff = useContext(DeskContext);
  return staff ? <>{children}</> : <Loading label="Loading your desk" testId="agent-shell-loading" />;
}
