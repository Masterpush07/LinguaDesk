"use client";

import { useEffect, useState } from "react";
import ChatThread from "@/components/ChatThread";
import {
  connect,
  getOwnerSession,
  savedOwnerSession,
  signOutOwner,
} from "@/lib/nexconn-client";
import {
  useOwnerInbox,
  useOwnerThread,
  type OwnerConversation,
} from "@/lib/use-owner";

const STATUS_LABEL: Record<
  OwnerConversation["status"],
  { text: string; className: string }
> = {
  waiting: { text: "Needs you", className: "bg-amber-100 text-amber-800" },
  human: { text: "You", className: "bg-green-100 text-green-800" },
  ai: { text: "AI", className: "bg-gray-100 text-gray-600" },
};

function customerName(id: string) {
  return `Customer ${id.slice(-6)}`;
}

function InfoBar({
  conversation,
  onHandBack,
}: {
  conversation: OwnerConversation;
  onHandBack: () => void;
}) {
  const label = STATUS_LABEL[conversation.status];
  return (
    <div className="flex items-start justify-between gap-3 border-b border-gray-200 bg-white px-4 py-2 text-sm">
      <div className="min-w-0">
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${label.className}`}
        >
          {label.text}
        </span>
        {conversation.language && (
          <span className="ml-2 text-xs text-gray-500">
            {conversation.language}
          </span>
        )}
        {conversation.summary && (
          <p className="mt-1 text-gray-700">
            AI summary: {conversation.summary}
          </p>
        )}
        {conversation.status === "ai" && (
          <p className="mt-1 text-gray-500">
            The AI assistant is answering this customer.
          </p>
        )}
      </div>
      {conversation.status !== "ai" && (
        <button
          onClick={onHandBack}
          className="shrink-0 rounded border border-gray-300 px-3 py-1 text-xs text-gray-700 hover:bg-gray-50"
        >
          Hand back to AI
        </button>
      )}
    </div>
  );
}

function OwnerThread({
  peerId,
  onChanged,
}: {
  peerId: string;
  onChanged: () => void;
}) {
  const { conversation, messages, connected, send, handBack } = useOwnerThread(
    peerId,
    onChanged,
  );
  return (
    <div className="flex h-full min-h-0 flex-col">
      {conversation && (
        <InfoBar conversation={conversation} onHandBack={handBack} />
      )}
      <div className="min-h-0 flex-1">
        <ChatThread
          title={customerName(peerId)}
          messages={messages}
          connected={connected}
          onSend={send}
        />
      </div>
    </div>
  );
}

function Dashboard() {
  const { conversations, error, refresh } = useOwnerInbox();
  const [selected, setSelected] = useState<string | null>(null);

  async function signOut() {
    await fetch("/api/owner/logout", { method: "POST" });
    signOutOwner();
    location.reload();
  }

  return (
    <div className="flex h-screen bg-white text-gray-900">
      <aside className="w-80 shrink-0 overflow-y-auto border-r border-gray-200">
        <h1 className="border-b border-gray-200 px-4 py-3 font-semibold">
          Conversations
        </h1>
        <button
          onClick={signOut}
          className="w-full border-b border-gray-200 px-4 py-2 text-left text-xs text-gray-500 hover:bg-gray-50"
        >
          Sign out
        </button>
        {error && <p className="p-4 text-sm text-red-600">{error}</p>}
        {!error && conversations.length === 0 && (
          <p className="p-4 text-sm text-gray-500">No customers yet.</p>
        )}
        {conversations.map((c) => (
          <button
            key={c.customer_id}
            onClick={() => setSelected(c.customer_id)}
            className={`block w-full border-b border-gray-100 px-4 py-3 text-left hover:bg-gray-50 ${
              selected === c.customer_id ? "bg-indigo-50" : ""
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">{customerName(c.customer_id)}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_LABEL[c.status].className}`}
              >
                {STATUS_LABEL[c.status].text}
              </span>
            </div>
            <p dir="auto" className="truncate text-sm text-gray-500">
              {c.last_text}
            </p>
          </button>
        ))}
      </aside>
      <section className="min-w-0 flex-1">
        {selected ? (
          <OwnerThread key={selected} peerId={selected} onChanged={refresh} />
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
      <form
        onSubmit={login}
        className="w-80 space-y-3 rounded bg-white p-6 shadow"
      >
        <h1 className="text-lg font-semibold">Shop owner login</h1>
        <input
          type="password"
          className="w-full rounded border border-gray-300 bg-white p-2 text-gray-900"
          placeholder="Passcode"
          value={passcode}
          onChange={(e) => setPasscode(e.target.value)}
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          disabled={busy || !passcode}
          className="w-full rounded bg-indigo-600 py-2 text-white disabled:opacity-40"
        >
          {busy ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </main>
  );
}
