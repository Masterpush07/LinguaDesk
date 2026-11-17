"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "@/lib/nexconn-client";

type Props = {
  title: string;
  messages: ChatMessage[];
  connected: boolean;
  onSend: (text: string) => Promise<void>;
  footnote?: string;
};

// Presentational chat window; colours are explicit so it stays readable in OS dark mode.
export default function ChatThread({ title, messages, connected, onSend, footnote }: Props) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = text.trim();
    if (!value || sending) return;
    setSending(true);
    setError("");
    try {
      await onSend(value);
      setText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-white text-gray-900">
      <header className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
        <h2 className="font-semibold">{title}</h2>
        <span className={connected ? "text-xs text-green-600" : "text-xs text-amber-600"}>
          {connected ? "Online" : "Reconnecting..."}
        </span>
      </header>

      <div className="flex-1 space-y-2 overflow-y-auto bg-gray-50 p-4">
        {messages.length === 0 && <p className="text-center text-sm text-gray-500">No messages yet. Say hello!</p>}
        {messages.map((m) => (
          <div key={m.id} className={m.mine ? "flex justify-end" : "flex justify-start"}>
            <div
              className={
                m.mine
                  ? "max-w-[75%] rounded-2xl rounded-br-sm bg-indigo-600 px-3 py-2 text-white"
                  : "max-w-[75%] rounded-2xl rounded-bl-sm bg-white px-3 py-2 text-gray-900 shadow"
              }
            >
              {/* dir="auto" lets Arabic and other right-to-left text lay out correctly. */}
              {m.ai && <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-500">AI assistant</p>}
              <p dir="auto" className="whitespace-pre-wrap break-words">
                {m.text}
              </p>
              {m.translation && (
                <p className="mt-1 border-t border-gray-200 pt-1 text-xs italic text-gray-500">EN: {m.translation}</p>
              )}
              <p className={m.mine ? "mt-1 text-right text-[10px] text-indigo-200" : "mt-1 text-[10px] text-gray-400"}>
                {new Date(m.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={submit} className="border-t border-gray-200 p-3">
        {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
        <div className="flex gap-2">
          <input
            dir="auto"
            className="flex-1 rounded-full border border-gray-300 bg-white px-4 py-2 text-gray-900 outline-none focus:border-indigo-500"
            placeholder="Type a message..."
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <button
            type="submit"
            disabled={sending || !text.trim()}
            className="rounded-full bg-indigo-600 px-5 py-2 text-white disabled:opacity-40"
          >
            {sending ? "Sending..." : "Send"}
          </button>
        </div>
        {footnote && <p className="mt-2 text-[11px] text-gray-400">{footnote}</p>}
      </form>
    </div>
  );
}
