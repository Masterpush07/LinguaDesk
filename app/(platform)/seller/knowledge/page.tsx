import { Suspense } from "react";
import KnowledgeManager from "@/components/platform/seller/KnowledgeManager";
import { LoadingBlock } from "@/components/platform/seller/ui";
import { PageHeading } from "@/components/platform/ui";

export const metadata = { title: "Knowledge base · LinguaDesk Seller Studio" };

export default function KnowledgePage() {
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeading title="Knowledge base" subtitle="The questions and answers your AI assistant uses. Write them once in English and they are translated for your customers." />
      <Suspense fallback={<LoadingBlock label="Loading the knowledge base" testId="knowledge-page-loading" />}>
        <KnowledgeManager />
      </Suspense>
    </div>
  );
}
