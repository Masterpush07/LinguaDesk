import type { Metadata } from "next";
import ChatThreadList from "@/components/platform/chat/ChatThreadList";
import SiteFooter from "@/components/platform/SiteFooter";
import { NextAction, PageHeading } from "@/components/platform/ui";

export const metadata: Metadata = { title: "My conversations | LinguaDesk" };

export default function ChatsPage() {
  return (
    <main>
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <PageHeading title="My conversations" subtitle="Your conversations with shops. Each one shows who is responding and what happens next." />
        <ChatThreadList />
        <div className="mt-8">
          <NextAction title="Looking for something new?" text="Browse shops from around the world and ask questions in your own language." href="/marketplace" cta="Browse the marketplace" />
        </div>
      </div>
      <SiteFooter />
    </main>
  );
}
