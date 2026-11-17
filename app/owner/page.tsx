"use client";

import { useEffect, useState } from "react";
import ChatThread from "@/components/ChatThread";
import ThemeToggle from "@/components/ThemeToggle";
import { connect, getOwnerSession, savedOwnerSession, signOutOwner } from "@/lib/nexconn-client";
import { useOwnerInbox, useOwnerThread, type OwnerConversation } from "@/lib/use-owner";

type Status = OwnerConversation["status"];

const STATUS: Record<Status, { label: string; pill: string; dot: string }> = {
  waiting: { label: "Needs you", pill: "bg-warn-soft text-warn-ink", dot: "bg-amber-500" },
  human: { label: "You", pill: "bg-ok-soft text-ok-ink", dot: "bg-emerald-500" },
  ai: { label: "AI", pill: "bg-ai-soft text-ai-ink", dot: "bg-violet-400" },
};

const customerName = (id: string) => `Customer ${id.slice(-6)}`;

// Minute-resolution clock for relative times; null until mounted so server and client markup match.
function useNow() {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const interval = setInterval(tick, 60_000);
    return () => {
      clearTimeout(first);
      clearInterval(interval);
    };
  }, []);
  return now;
}

function ago(iso: string, now: number | null) {
  if (now === null) return "";
  const time = new Date(iso).getTime();
  const minutes = Math.floor((now - time) / 60_000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h`;
  return new Date(time).toLocaleDateString([], { month: "short", day: "numeric" });
}

function StatusPill({ status }: { status: Status }) {
  const s = STATUS[status];
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${s.pill}`}>{s.label}</span>;
}

function Avatar({ id, size = "h-10 w-10" }: { id: string; size?: string }) {
  return (
    <div className={`${size} flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-sm font-semibold text-white`} aria-hidden="true">
      {customerName(id).slice(-6, -5).toUpperCase()}
    </div>
  );
}

function InfoBanner({ conversation, onHandBack }: { conversation: OwnerConversation; onHandBack: () => Promise<void> }) {
  const { status, summary } = conversation;
  const tone = status === "waiting" ? "bg-warn-soft text-warn-ink" : status === "human" ? "bg-ok-soft text-ok-ink" : "bg-ai-soft text-ai-ink";
  const headline =
    status === "waiting"
      ? "This customer needs you"
      : status === "human"
        ? "You're handling this chat. The AI is paused."
        : "The AI is answering. Reply to take over.";
  return (
    <div className={`flex items-start justify-between gap-3 px-4 py-2.5 text-sm ${tone}`}>
      <div className="min-w-0">
        <p className="font-semibold">{headline}</p>
        {summary && (
          <p className="mt-0.5 opacity-90">
            <span className="font-medium">AI summary:</span> {summary}
          </p>
        )}
      </div>
      {status !== "ai" && (
        <button
          onClick={() => void onHandBack().catch(() => {})}
          className="shrink-0 rounded-full bg-surface px-3 py-1.5 text-xs font-medium text-ink ring-1 ring-line transition hover:bg-surface-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
        >
          Hand back to AI
        </button>
      )}
    </div>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label="Back to conversations"
      className="-ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-2 hover:bg-surface-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 md:hidden"
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M15 18l-6-6 6-6" />
      </svg>
    </button>
  );
}

function OwnerThread({ peerId, onChanged, onBack }: { peerId: string; onChanged: () => void; onBack: () => void }) {
  const { conversation, messages, connected, send, handBack } = useOwnerThread(peerId, onChanged);
  const language = conversation?.language;
  const translated = !!language && !/^english$/i.test(language);
  return (
    <ChatThread
      title={customerName(peerId)}
      subtitle={language ? `Speaks ${language}` : undefined}
      leading={<BackButton onClick={onBack} />}
      banner={conversation && <InfoBanner conversation={conversation} onHandBack={handBack} />}
      messages={messages}
      connected={connected}
      onSend={send}
      placeholder={translated ? `Reply in English. It is sent in ${language}.` : "Reply to the customer"}
    />
  );
}

function ConversationRow({ c, selected, now, onSelect }: { c: OwnerConversation; selected: boolean; now: number | null; onSelect: () => void }) {
  const urgent = c.status === "waiting";
  return (
    <button
      onClick={onSelect}
      aria-current={selected ? "true" : undefined}
      className={`relative flex w-full items-center gap-3 border-b border-line-soft px-4 py-3 text-left transition hover:bg-surface-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand/60 ${selected ? "bg-brand-soft" : ""}`}
    >
      {urgent && <span className="absolute inset-y-0 left-0 w-1 bg-amber-500" aria-hidden="true" />}
      <Avatar id={c.customer_id} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className={`truncate text-sm ${urgent ? "font-semibold" : "font-medium"}`}>{customerName(c.customer_id)}</span>
          <span className="shrink-0 text-[11px] text-ink-3">{ago(c.last_at, now)}</span>
        </div>
        <p dir="auto" className="truncate text-[13px] text-ink-2">
          {c.last_text}
        </p>
        <div className="mt-1 flex items-center gap-2">
          <StatusPill status={c.status} />
          {c.language && <span className="truncate text-[11px] text-ink-3">{c.language}</span>}
        </div>
      </div>
    </button>
  );
}

function ListSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading conversations">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-3 border-b border-line-soft px-4 py-3">
          <div className="h-10 w-10 animate-pulse rounded-full bg-surface-3" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-1/2 animate-pulse rounded bg-surface-3" />
            <div className="h-2.5 w-3/4 animate-pulse rounded bg-surface-3" />
          </div>
        </div>
      ))}
    </div>
  );
}

function Dashboard() {
  const { conversations, error, loaded, refresh } = useOwnerInbox();
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "waiting">("all");
  const now = useNow();

  const waiting = conversations.filter((c) => c.status === "waiting").length;
  const visible = filter === "waiting" ? conversations.filter((c) => c.status === "waiting") : conversations;

  // The browser tab shows how many customers need you, so it is noticeable even when the tab is in the background.
  useEffect(() => {
    document.title = waiting > 0 ? `(${waiting}) Needs you - LinguaDesk` : "Inbox - LinguaDesk";
  }, [waiting]);

  async function signOut() {
    await fetch("/api/owner/logout", { method: "POST" });
    signOutOwner();
    location.reload();
  }

  return (
    <div className="flex h-dvh bg-surface text-ink">
      <aside className={`${selected ? "hidden md:flex" : "flex"} w-full min-w-0 shrink-0 flex-col border-r border-line md:w-96`}>
        <div className="flex items-center gap-2 border-b border-line-soft px-4 py-3">
          <h1 className="text-lg font-semibold">Inbox</h1>
          {waiting > 0 && <span className="rounded-full bg-amber-500 px-2 py-0.5 text-xs font-bold text-white">{waiting}</span>}
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <button onClick={signOut} className="rounded-full px-3 py-1.5 text-xs font-medium text-ink-2 hover:bg-surface-3 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60">
              Sign out
            </button>
          </div>
        </div>

        <div className="flex gap-1 border-b border-line-soft px-4 py-2" role="tablist" aria-label="Filter conversations">
          {(["all", "waiting"] as const).map((f) => (
            <button
              key={f}
              role="tab"
              aria-selected={filter === f}
              onClick={() => setFilter(f)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 ${filter === f ? "bg-ink text-surface" : "text-ink-2 hover:bg-surface-3"}`}
            >
              {f === "all" ? `All (${conversations.length})` : `Needs you (${waiting})`}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {error && (
            <p role="alert" className="m-4 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger-ink">
              Could not load conversations. {error}
            </p>
          )}
          {!loaded && !error && <ListSkeleton />}
          {loaded && !error && visible.length === 0 && (
            <div className="px-6 py-14 text-center">
              <p className="font-medium">{filter === "waiting" ? "Nobody needs you right now" : "No conversations yet"}</p>
              <p className="mt-1 text-sm text-ink-2">
                {filter === "waiting" ? "The AI is handling everything." : "Customers who open the chat link will show up here."}
              </p>
              {filter === "all" && (
                <a href="/chat" target="_blank" rel="noreferrer" className="mt-4 inline-block rounded-full bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover">
                  Open the customer chat
                </a>
              )}
            </div>
          )}
          {visible.map((c) => (
            <ConversationRow key={c.customer_id} c={c} selected={selected === c.customer_id} now={now} onSelect={() => setSelected(c.customer_id)} />
          ))}
        </div>
      </aside>

      <section className={`${selected ? "flex" : "hidden md:flex"} min-w-0 flex-1 flex-col`}>
        {selected ? (
          <OwnerThread key={selected} peerId={selected} onChanged={refresh} onBack={() => setSelected(null)} />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center bg-surface-2 px-8 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-soft text-2xl" aria-hidden="true">
              &#128172;
            </div>
            <p className="mt-4 font-semibold">Select a conversation</p>
            <p className="mt-1 max-w-xs text-sm text-ink-2">Customers write in their language. You read and reply in English.</p>
          </div>
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
  if (restoring) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-surface-2">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-line border-t-brand" role="status" aria-label="Loading" />
      </main>
    );
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-gradient-to-b from-brand-soft via-surface to-surface px-4 text-ink">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <form onSubmit={login} className="w-full max-w-sm space-y-4 rounded-2xl bg-surface p-7 shadow-xl ring-1 ring-line">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-ink">LinguaDesk</p>
          <h1 className="mt-1 text-2xl font-bold">Shop owner sign in</h1>
          <p className="mt-1 text-sm text-ink-2">Enter the passcode to read and answer customer chats.</p>
        </div>
        <div>
          <label htmlFor="passcode" className="text-sm font-medium">
            Passcode
          </label>
          <input
            id="passcode"
            type="password"
            autoComplete="current-password"
            autoFocus
            className="mt-1 w-full rounded-xl border border-line bg-surface-2 px-4 py-2.5 text-ink outline-none transition placeholder:text-ink-3 focus:border-brand focus:bg-surface focus:ring-2 focus:ring-brand/20"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
          />
        </div>
        {error && (
          <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger-ink">
            {error}
          </p>
        )}
        <button
          disabled={busy || !passcode}
          className="w-full rounded-xl bg-brand py-2.5 font-medium text-white transition hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:bg-surface-3 disabled:text-ink-3"
        >
          {busy ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </main>
  );
}
