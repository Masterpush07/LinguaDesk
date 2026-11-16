"use client";

import { useEffect, useState } from "react";
import ChatThread from "@/components/ChatThread";
import { connect, forgetGuest, getGuestSession } from "@/lib/nexconn-client";
import { SHOP_ID, SHOP_NAME } from "@/lib/shop";
import { useConversation } from "@/lib/use-chat";

function ShopChat() {
  const { messages, connected, send } = useConversation(SHOP_ID);
  return <ChatThread title={SHOP_NAME} messages={messages} connected={connected} onSend={send} />;
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
    <main className="mx-auto h-screen max-w-md bg-white text-gray-900 shadow">
      {ready ? (
        <ShopChat />
      ) : error ? (
        <div className="space-y-3 p-6">
          <p className="text-red-600">{error}</p>
          <button
            className="rounded bg-indigo-600 px-4 py-2 text-white"
            onClick={() => {
              forgetGuest();
              location.reload();
            }}
          >
            Start a new chat
          </button>
        </div>
      ) : (
        <p className="p-6 text-gray-500">Connecting...</p>
      )}
    </main>
  );
}
