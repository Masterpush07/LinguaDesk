import GlossaryManager from "@/components/platform/seller/GlossaryManager";
import { PageHeading } from "@/components/platform/ui";

export const metadata = { title: "AI glossary · LinguaDesk Seller Studio" };

export default function GlossaryPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeading title="AI translation glossary" subtitle="Specify which terms the AI should leave untranslated, which it should always translate the same way, and the tone it should use." />
      <GlossaryManager />
    </div>
  );
}
