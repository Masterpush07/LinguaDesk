import type { ReactNode } from "react";
import AgentShell from "@/components/platform/AgentShell";

export default function AgentLayout({ children }: { children: ReactNode }) {
  return <AgentShell>{children}</AgentShell>;
}
