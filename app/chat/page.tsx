"use client";

import { useEffect, useState } from "react";
import ChatThread from "@/components/ChatThread";
import ThemeToggle from "@/components/ThemeToggle";
import { connect, forgetGuest, getGuestSession, type ChatMessage } from "@/lib/nexconn-client";
import { SHOP_ID, SHOP_NAME } from "@/lib/shop";
import { useConversation } from "@/lib/use-chat";

// Tapping one sends it as the first message; the mix of languages shows off translation right away.
const SUGGESTIONS = [
  "How much is the tote bag?",
  "¿Cuánto cuesta la bufanda y envían a España?",
  "क्या टोट बैग की कीमत बता सकते हैं?",
  "What is your return policy?",
];

const TYPING_TIMEOUT_MS = 25_000;

// The AI answers every customer message unless the shop owner has joined, so "typing" is shown while a reply is due.
function useAssistantTyping(messages: ChatMessage[]) {
  const last = messages.at(-1);
  const ownerJoined = messages.some((m) => !m.mine && !m.ai);
  const replyDue = !!last && last.mine && !ownerJoined;
  const [gaveUp, setGaveUp] = useState<string | null>(null);

  const lastId = last?.id;
  const lastTime = last?.time ?? 0;
  useEffect(() => {
    if (!replyDue || !lastId) return;
    // Stop after a while (or at once for an old unanswered message) so a failed reply never leaves dots bouncing forever.
    const wait = Math.max(0, TYPING_TIMEOUT_MS - (Date.now() - lastTime));
    const timer = setTimeout(() => setGaveUp(lastId), wait);
    return () => clearTimeout(timer);
  }, [replyDue, lastId, lastTime]);

  return replyDue && gaveUp !== lastId;
}

function ShopChat() {
  const { messages, connected, send } = useConversation(SHOP_ID);
  const typing = useAssistantTyping(messages);
  return (
    <ChatThread
      title={SHOP_NAME}
      subtitle="AI-assisted support · write in any language"
      peerLabel="Shop team"
      actions={<ThemeToggle />}
      messages={messages}
      connected={connected}
      onSend={send}
      typing={typing}
      suggestions={SUGGESTIONS}
      emptyTitle="Hi! How can we help?"
      emptyText="Ask about products, prices, shipping or returns. We reply in your language."
      footnote="Replies may be written by AI (Google Gemini). Please don't share sensitive information."
    />
  );
}

function ChatSkeleton() {
  return (
    <div className="flex h-full flex-col" aria-busy="true" aria-label="Connecting to chat">
      <div className="flex items-center gap-3 border-b border-line-soft px-4 py-3">
        <div className="h-10 w-10 animate-pulse rounded-full bg-surface-3" />
        <div className="space-y-2">
          <div className="h-3 w-36 animate-pulse rounded bg-surface-3" />
          <div className="h-2.5 w-24 animate-pulse rounded bg-surface-3" />
        </div>
      </div>
      <div className="flex-1 space-y-3 bg-surface-2 p-4">
        <div className="h-10 w-2/3 animate-pulse rounded-2xl bg-surface-3" />
        <div className="ml-auto h-10 w-1/2 animate-pulse rounded-2xl bg-brand-soft" />
        <div className="h-16 w-3/4 animate-pulse rounded-2xl bg-surface-3" />
      </div>
    </div>
  );
}

function ConnectionError({ message }: { message: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center bg-surface px-8 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-danger-soft text-xl" aria-hidden="true">
        &#9888;
      </div>
      <h1 className="mt-4 text-lg font-semibold text-ink">We couldn&apos;t connect</h1>
      <p className="mt-1 text-sm text-ink-2">Check your internet connection and try again.</p>
      <p className="mt-2 max-w-full truncate text-xs text-ink-3">{message}</p>
      <button
        className="mt-5 rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
        onClick={() => {
          forgetGuest();
          location.reload();
        }}
      >
        Try again
      </button>
    </div>
  );
}

// Customer view: a guest opens the link and chats with the shop, no signup.
export default function ChatPage() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getGuestSession()
      .then(connect)
      .then(() => setReady(true))
      .catch((err: Error) => setError(err.message));
  }, []);

  return (
    <main className="flex min-h-dvh justify-center bg-gradient-to-b from-brand-soft via-surface to-surface text-ink sm:items-center sm:p-6">
      <div className="h-dvh w-full max-w-md overflow-hidden bg-surface sm:h-[min(760px,calc(100dvh-3rem))] sm:rounded-2xl sm:shadow-xl sm:ring-1 sm:ring-line">
        {ready ? <ShopChat /> : error ? <ConnectionError message={error} /> : <ChatSkeleton />}
      </div>
    </main>
  );
}
