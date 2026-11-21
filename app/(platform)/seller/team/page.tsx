import TeamManager from "@/components/platform/seller/TeamManager";
import { PageHeading } from "@/components/platform/ui";

export const metadata = { title: "Team · LinguaDesk Seller Studio" };

export default function TeamPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeading title="Team" subtitle="Optional. Your AI assistant answers customers first and notifies you when it cannot. Add teammates only if other people will reply to customers as well." />
      <TeamManager />
    </div>
  );
}
