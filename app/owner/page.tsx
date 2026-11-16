"use client";

import { useEffect, useState } from "react";
import ChatThread from "@/components/ChatThread";
import { connect, getOwnerSession, savedOwnerSession, signOutOwner } from "@/lib/nexconn-client";
import { useConversation, useConversations } from "@/lib/use-chat";

function OwnerThread({ peerId, onSent }: { peerId: string; onSent: () => void }) {
  const { messages, connected, send } = useConversation(peerId, true);
  return (
    <ChatThread
      title={`Customer ${peerId.slice(-6)}`}
      messages={messages}
      connected={connected}
      onSend={async (text) => {
        await send(text);
        onSent();
      }}
    />
  );
}

function Dashboard() {
  const { conversations, refresh } = useConversations();
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="flex h-screen bg-white text-gray-900">
      <aside className="w-72 shrink-0 overflow-y-auto border-r border-gray-200">
        <h1 className="border-b border-gray-200 px-4 py-3 font-semibold">Conversations</h1>
        <button
          className="w-full border-b border-gray-200 px-4 py-2 text-left text-xs text-gray-500 hover:bg-gray-50"
          onClick={() => {
            signOutOwner();
            location.reload();
          }}
        >
          Sign out
        </button>
        {conversations.length === 0 && <p className="p-4 text-sm text-gray-500">No customers yet.</p>}
        {conversations.map((c) => (
          <button
            key={c.peerId}
            onClick={() => setSelected(c.peerId)}
            className={`block w-full border-b border-gray-100 px-4 py-3 text-left hover:bg-gray-50 ${
              selected === c.peerId ? "bg-indigo-50" : ""
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-medium">Customer {c.peerId.slice(-6)}</span>
              {c.unread > 0 && selected !== c.peerId && (
                <span className="rounded-full bg-indigo-600 px-2 text-xs text-white">{c.unread}</span>
              )}
            </div>
            <p dir="auto" className="truncate text-sm text-gray-500">
              {c.lastText}
            </p>
          </button>
        ))}
      </aside>
      <section className="min-w-0 flex-1">
        {selected ? (
          <OwnerThread key={selected} peerId={selected} onSent={refresh} />
        ) : (
          <p className="p-6 text-gray-500">Select a conversation.</p>
        )}
      </section>
    </div>
  );
}

// Shop owner view: passcode login, then the inbox of customer conversations.
export default function OwnerPage() {
  const [ready, setReady] = useState(false);
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [restoring, setRestoring] = useState(true);

  // A reload keeps the owner signed in for as long as the tab stays open.
  useEffect(() => {
    const saved = savedOwnerSession();
    (saved ? connect(saved) : Promise.reject(new Error("no saved session")))
      .then(() => setReady(true))
      .catch(() => signOutOwner())
      .finally(() => setRestoring(false));
  }, []);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await connect(await getOwnerSession(passcode));
      setReady(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  if (ready) return <Dashboard />;
  if (restoring) return <p className="p-6 text-gray-500">Loading...</p>;

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 text-gray-900">
      <form onSubmit={login} className="w-80 space-y-3 rounded bg-white p-6 shadow">
        <h1 className="text-lg font-semibold">Shop owner login</h1>
        <input
          type="password"
          className="w-full rounded border border-gray-300 bg-white p-2 text-gray-900"
          placeholder="Passcode"
          value={passcode}
          onChange={(e) => setPasscode(e.target.value)}
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button disabled={busy || !passcode} className="w-full rounded bg-indigo-600 py-2 text-white disabled:opacity-40">
          {busy ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </main>
  );
}
