"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "@/lib/nexconn-client";

type Props = {
  title: string;
  subtitle?: string;
  peerLabel?: string; // name above the first incoming bubble of a group; AI messages are always labelled "AI assistant"
  messages: ChatMessage[];
  connected: boolean;
  onSend: (text: string) => Promise<void>;
  footnote?: string;
  typing?: boolean;
  suggestions?: string[]; // one-tap first messages shown while the chat is empty
  emptyTitle?: string;
  emptyText?: string;
};

const MAX_LENGTH = 1000; // the server trims AI input to the same length
const GROUP_GAP_MS = 5 * 60 * 1000;

type Row = { message: ChatMessage; startsGroup: boolean; endsGroup: boolean; dayLabel?: string };

// Consecutive messages from the same sender within a few minutes share one visual group.
function toRows(messages: ChatMessage[]): Row[] {
  return messages.map((message, i) => {
    const prev = messages[i - 1];
    const next = messages[i + 1];
    const sameGroup = (a?: ChatMessage, b?: ChatMessage) =>
      !!a && !!b && a.mine === b.mine && a.ai === b.ai && Math.abs(b.time - a.time) < GROUP_GAP_MS;
    const day = new Date(message.time).toDateString();
    const newDay = !prev || new Date(prev.time).toDateString() !== day;
    return {
      message,
      startsGroup: newDay || !sameGroup(prev, message),
      endsGroup: !sameGroup(message, next) || new Date(next!.time).toDateString() !== day,
      dayLabel: newDay ? new Date(message.time).toLocaleDateString([], { month: "short", day: "numeric" }) : undefined,
    };
  });
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 19V5M5 12l7-7 7 7" />
    </svg>
  );
}

function AiBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-700">
      <svg viewBox="0 0 24 24" className="h-2.5 w-2.5" fill="currentColor" aria-hidden="true">
        <path d="M12 2l1.9 6.1L20 10l-6.1 1.9L12 18l-1.9-6.1L4 10l6.1-1.9L12 2z" />
      </svg>
      AI assistant
    </span>
  );
}

function TypingBubble() {
  return (
    <div className="bubble-in flex justify-start" role="status">
      <span className="sr-only">The assistant is typing</span>
      <div className="flex items-center gap-1 rounded-2xl rounded-bl-md bg-violet-50 px-4 py-3 ring-1 ring-violet-100" aria-hidden="true">
        {[0, 150, 300].map((delay) => (
          <span key={delay} className="h-1.5 w-1.5 animate-bounce rounded-full bg-violet-400 motion-reduce:animate-none" style={{ animationDelay: `${delay}ms` }} />
        ))}
      </div>
    </div>
  );
}

// Presentational chat window shared by the customer and owner screens; colours are explicit so OS dark mode cannot break it.
export default function ChatThread({
  title,
  subtitle,
  peerLabel,
  messages,
  connected,
  onSend,
  footnote,
  typing = false,
  suggestions = [],
  emptyTitle = "No messages yet",
  emptyText = "New messages appear here.",
}: Props) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [atBottom, setAtBottom] = useState(true);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const stickToBottom = useRef(true);
  const firstScroll = useRef(true);

  // Follow new messages only while the reader is already at the bottom, so scrolling back through history is never hijacked.
  useEffect(() => {
    const el = listRef.current;
    if (!el || !stickToBottom.current || (messages.length === 0 && !typing)) return;
    el.scrollTo({ top: el.scrollHeight, behavior: firstScroll.current ? "auto" : "smooth" });
    firstScroll.current = false;
  }, [messages, typing]);

  // Grow the box with the text up to a limit, then let it scroll.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  }, [text]);

  function onScroll() {
    const el = listRef.current;
    if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 96;
    stickToBottom.current = near;
    setAtBottom(near);
  }

  function jumpToLatest() {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }

  async function deliver(raw: string) {
    const value = raw.trim();
    if (!value || sending) return;
    setSending(true);
    setError("");
    stickToBottom.current = true;
    try {
      await onSend(value);
      setText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send. Please try again.");
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // isComposing: Enter confirms a Japanese/Chinese/Korean IME candidate and must not send the message.
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void deliver(text);
    }
  }

  const rows = toRows(messages);

  return (
    <div className="flex h-full min-h-0 flex-col bg-white text-gray-900">
      <header className="flex items-center gap-3 border-b border-gray-100 px-4 py-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-base font-semibold text-white" aria-hidden="true">
          {title.trim().charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[15px] font-semibold leading-tight">{title}</h2>
          {subtitle && <p className="truncate text-xs text-gray-500">{subtitle}</p>}
        </div>
        <span className={`flex items-center gap-1.5 text-xs font-medium ${connected ? "text-emerald-600" : "text-amber-600"}`}>
          <span className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-500" : "animate-pulse bg-amber-500"}`} />
          {connected ? "Online" : "Reconnecting"}
        </span>
      </header>

      <div className="relative min-h-0 flex-1">
        <div
          ref={listRef}
          onScroll={onScroll}
          role="log"
          aria-live="polite"
          aria-label="Conversation"
          className="h-full space-y-0.5 overflow-y-auto overscroll-contain bg-gray-50 px-3 py-4 sm:px-4"
        >
          {rows.length === 0 && (
            <div className="mx-auto flex max-w-xs flex-col items-center px-2 py-10 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100 text-xl" aria-hidden="true">
                &#128172;
              </div>
              <h3 className="mt-4 text-base font-semibold">{emptyTitle}</h3>
              <p className="mt-1 text-sm text-gray-500">{emptyText}</p>
              {suggestions.length > 0 && (
                <div className="mt-5 flex w-full flex-col gap-2">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      dir="auto"
                      onClick={() => void deliver(s)}
                      disabled={sending}
                      className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-left text-sm text-gray-700 transition hover:border-indigo-300 hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-50"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {rows.map(({ message: m, startsGroup, endsGroup, dayLabel }) => (
            <div key={m.id}>
              {dayLabel && <p className="my-3 text-center text-[11px] font-medium text-gray-400">{dayLabel}</p>}
              <div className={`bubble-in flex flex-col ${m.mine ? "items-end" : "items-start"} ${startsGroup && !dayLabel ? "pt-2" : ""}`}>
                {startsGroup && (m.ai || (!m.mine && peerLabel)) && (
                  <div className="mb-1 px-1">{m.ai ? <AiBadge /> : <span className="text-[11px] font-medium text-gray-500">{peerLabel}</span>}</div>
                )}
                <div
                  className={[
                    "max-w-[82%] px-3.5 py-2 text-[15px] leading-relaxed sm:max-w-[75%]",
                    m.mine ? "bg-indigo-600 text-white" : m.ai ? "bg-violet-50 text-gray-900 ring-1 ring-violet-100" : "bg-white text-gray-900 ring-1 ring-gray-200",
                    "rounded-2xl",
                    m.mine ? (endsGroup ? "rounded-br-md" : "") : endsGroup ? "rounded-bl-md" : "",
                  ].join(" ")}
                >
                  {/* dir="auto" lets Arabic and other right-to-left text lay out correctly. */}
                  <p dir="auto" className="whitespace-pre-wrap break-words">
                    {m.text}
                  </p>
                  {m.translation && (
                    <p dir="auto" className={`mt-1.5 border-t pt-1.5 text-xs ${m.mine ? "border-white/25 text-indigo-100" : "border-gray-200 text-gray-500"}`}>
                      <span className="font-semibold">{m.translationLabel ?? "English"}:</span> {m.translation}
                    </p>
                  )}
                  {m.numberWarning && (
                    <p className="mt-1.5 rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800 ring-1 ring-amber-200">
                      Numbers may not match the original. Verify before replying.
                    </p>
                  )}
                </div>
                {endsGroup && (
                  <p className="mt-1 px-1 text-[11px] text-gray-400">
                    {new Date(m.time).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                  </p>
                )}
              </div>
            </div>
          ))}
          {typing && <TypingBubble />}
        </div>

        {!atBottom && (
          <button
            onClick={jumpToLatest}
            className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-gray-900/90 px-3 py-1.5 text-xs font-medium text-white shadow-lg backdrop-blur hover:bg-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
          >
            Jump to latest
          </button>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void deliver(text);
        }}
        className="border-t border-gray-100 bg-white px-3 pb-3 pt-2.5 sm:px-4"
      >
        {error && (
          <p role="alert" className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-100">
            {error}
          </p>
        )}
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            dir="auto"
            rows={1}
            maxLength={MAX_LENGTH}
            aria-label="Message"
            placeholder="Type a message"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKeyDown}
            className="max-h-32 min-h-[44px] flex-1 resize-none rounded-2xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-[15px] leading-normal text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100"
          />
          <button
            type="submit"
            aria-label="Send message"
            disabled={sending || !text.trim()}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white transition hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 disabled:bg-gray-200 disabled:text-gray-400"
          >
            {sending ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : <SendIcon />}
          </button>
        </div>
        <div className="mt-1.5 flex items-start justify-between gap-3 px-1">
          {footnote ? <p className="text-[11px] leading-snug text-gray-400">{footnote}</p> : <span />}
          {text.length > MAX_LENGTH * 0.8 && (
            <span className="shrink-0 text-[11px] tabular-nums text-gray-400">
              {text.length}/{MAX_LENGTH}
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
