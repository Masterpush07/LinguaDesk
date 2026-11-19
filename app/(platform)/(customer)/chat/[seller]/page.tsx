import type { Metadata } from "next";
import { Suspense } from "react";
import BuyerChat from "@/components/platform/chat/BuyerChat";

export const metadata: Metadata = { title: "Conversation | LinguaDesk" };

function ChatLoading() {
  return (
    <div role="status" data-testid="chat-loading" className="flex min-h-0 flex-1 items-center justify-center bg-slate-50 text-sm text-slate-500">
      Opening your conversation...
    </div>
  );
}

export default function ChatPage({ params }: PageProps<"/chat/[seller]">) {
  return (
    <main className="flex h-[calc(100dvh-8.5rem)] min-h-0 flex-col md:h-[calc(100dvh-4rem)]">
      <Suspense fallback={<ChatLoading />}>
        <ChatContent params={params} />
      </Suspense>
    </main>
  );
}

async function ChatContent({ params }: Pick<PageProps<"/chat/[seller]">, "params">) {
  const { seller } = await params;
  return (
    <Suspense fallback={<ChatLoading />}>
      <BuyerChat slug={seller} />
    </Suspense>
  );
}
