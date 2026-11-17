"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { ChatMessage } from "@/lib/nexconn-client";

type Props = {
  title: string;
  subtitle?: string;
  leading?: ReactNode; // e.g. a back button on small screens
  actions?: ReactNode; // extra controls at the right of the header
  banner?: ReactNode; // strip under the header, e.g. the handoff status
  peerLabel?: string; // name above the first incoming bubble of a group; AI messages are always labelled "AI assistant"
  messages: ChatMessage[];
  connected: boolean;
  onSend: (text: string) => Promise<void>;
  placeholder?: string;
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
    <span className="inline-flex items-center gap-1 rounded-full bg-ai-soft px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ai-ink ring-1 ring-ai-line">
      <svg viewBox="0 0 24 24" className="h-2.5 w-2.5" fill="currentColor" aria-hidden="true">
        <path d="M12 2l1.9 6.1L20 10l-6.1 1.9L12 18l-1.9-6.1L4 10l6.1-1.9L12 2z" />
      </svg>
      AI assistant
    </span>
  );
}

function TypingBubble() {
  return (
    <div className="bubble-in flex justify-start pt-2" role="status">
      <span className="sr-only">The assistant is typing</span>
      <div className="flex items-center gap-1 rounded-2xl rounded-bl-md bg-ai-soft px-4 py-3 ring-1 ring-ai-line" aria-hidden="true">
        {[0, 150, 300].map((delay) => (
          <span key={delay} className="h-1.5 w-1.5 animate-bounce rounded-full bg-ai-ink/60 motion-reduce:animate-none" style={{ animationDelay: `${delay}ms` }} />
        ))}
      </div>
    </div>
  );
}

// Presentational chat window shared by the customer and owner screens; all colours come from theme tokens.
export default function ChatThread({
  title,
  subtitle,
  leading,
  actions,
  banner,
  peerLabel,
  messages,
  connected,
  onSend,
  placeholder = "Type a message",
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
    <div className="flex h-full min-h-0 flex-col bg-surface text-ink">
      <header className="flex items-center gap-2 border-b border-line-soft px-3 py-3 sm:px-4">
        {leading}
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-base font-semibold text-white" aria-hidden="true">
          {title.trim().charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1 pl-1">
          <h2 className="truncate text-[15px] font-semibold leading-tight">{title}</h2>
          {subtitle && <p className="truncate text-xs text-ink-2">{subtitle}</p>}
        </div>
        <span className={`flex items-center gap-1.5 text-xs font-medium ${connected ? "text-ok-ink" : "text-warn-ink"}`}>
          <span className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-500" : "animate-pulse bg-amber-500"}`} />
          <span className="hidden sm:inline">{connected ? "Online" : "Reconnecting"}</span>
        </span>
        {actions}
      </header>

      {banner}

      <div className="relative min-h-0 flex-1">
        <div
          ref={listRef}
          onScroll={onScroll}
          role="log"
          aria-live="polite"
          aria-label="Conversation"
          className="h-full space-y-0.5 overflow-y-auto overscroll-contain bg-surface-2 px-3 py-4 sm:px-4"
        >
          {rows.length === 0 && (
            <div className="mx-auto flex max-w-xs flex-col items-center px-2 py-10 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-soft text-xl" aria-hidden="true">
                &#128172;
              </div>
              <h3 className="mt-4 text-base font-semibold">{emptyTitle}</h3>
              <p className="mt-1 text-sm text-ink-2">{emptyText}</p>
              {suggestions.length > 0 && (
                <div className="mt-5 flex w-full flex-col gap-2">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      dir="auto"
                      onClick={() => void deliver(s)}
                      disabled={sending}
                      className="rounded-xl border border-line bg-surface px-4 py-2.5 text-left text-sm text-ink transition hover:border-brand hover:bg-brand-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 disabled:opacity-50"
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
              {dayLabel && <p className="my-3 text-center text-[11px] font-medium text-ink-3">{dayLabel}</p>}
              <div className={`bubble-in flex flex-col ${m.mine ? "items-end" : "items-start"} ${startsGroup && !dayLabel ? "pt-2" : ""}`}>
                {startsGroup && (m.ai || (!m.mine && peerLabel)) && (
                  <div className="mb-1 px-1">{m.ai ? <AiBadge /> : <span className="text-[11px] font-medium text-ink-2">{peerLabel}</span>}</div>
                )}
                <div
                  className={[
                    "max-w-[82%] rounded-2xl px-3.5 py-2 text-[15px] leading-relaxed sm:max-w-[75%]",
                    m.mine ? "bg-brand text-white" : m.ai ? "bg-ai-soft text-ink ring-1 ring-ai-line" : "bg-surface text-ink ring-1 ring-line",
                    m.mine ? (endsGroup ? "rounded-br-md" : "") : endsGroup ? "rounded-bl-md" : "",
                  ].join(" ")}
                >
                  {/* dir="auto" lets Arabic and other right-to-left text lay out correctly. */}
                  <p dir="auto" className="whitespace-pre-wrap break-words">
                    {m.text}
                  </p>
                  {m.translation && (
                    <p dir="auto" className={`mt-1.5 border-t pt-1.5 text-xs ${m.mine ? "border-white/25 text-white/80" : "border-line text-ink-2"}`}>
                      <span className="font-semibold">{m.translationLabel ?? "English"}:</span> {m.translation}
                    </p>
                  )}
                  {m.numberWarning && (
                    <p className="mt-1.5 rounded-md bg-warn-soft px-2 py-1 text-xs font-medium text-warn-ink ring-1 ring-warn-line">
                      Numbers may not match the original. Verify before replying.
                    </p>
                  )}
                </div>
                {endsGroup && (
                  <p className="mt-1 px-1 text-[11px] text-ink-3">
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
            className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-ink px-3 py-1.5 text-xs font-medium text-surface shadow-lg hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
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
        className="border-t border-line-soft bg-surface px-3 pb-3 pt-2.5 sm:px-4"
      >
        {error && (
          <p role="alert" className="mb-2 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger-ink">
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
            placeholder={placeholder}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKeyDown}
            className="max-h-32 min-h-[44px] flex-1 resize-none rounded-2xl border border-line bg-surface-2 px-4 py-2.5 text-[15px] leading-normal text-ink outline-none transition placeholder:text-ink-3 focus:border-brand focus:bg-surface focus:ring-2 focus:ring-brand/20"
          />
          <button
            type="submit"
            aria-label="Send message"
            disabled={sending || !text.trim()}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand text-white transition hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:bg-surface-3 disabled:text-ink-3"
          >
            {sending ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : <SendIcon />}
          </button>
        </div>
        <div className="mt-1.5 flex items-start justify-between gap-3 px-1">
          {footnote ? <p className="text-[11px] leading-snug text-ink-3">{footnote}</p> : <span />}
          {text.length > MAX_LENGTH * 0.8 && (
            <span className="shrink-0 text-[11px] tabular-nums text-ink-3">
              {text.length}/{MAX_LENGTH}
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
