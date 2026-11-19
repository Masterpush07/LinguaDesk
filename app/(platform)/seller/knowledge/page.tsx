import KnowledgeManager from "@/components/platform/seller/KnowledgeManager";
import { PageHeading } from "@/components/platform/ui";

export const metadata = { title: "Knowledge base · LinguaDesk Seller Studio" };

export default function KnowledgePage() {
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeading title="Knowledge base" subtitle="The questions and answers your AI assistant uses. Write them once in English and they are translated for your customers." />
      <KnowledgeManager />
    </div>
  );
}
