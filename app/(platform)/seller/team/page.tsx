import TeamManager from "@/components/platform/seller/TeamManager";
import { PageHeading } from "@/components/platform/ui";

export const metadata = { title: "Team · LinguaDesk Seller Studio" };

export default function TeamPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeading title="Team" subtitle="The agents who take over when the AI hands off a conversation. Review languages and workload before adding more." />
      <TeamManager />
    </div>
  );
}
