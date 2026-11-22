"use client";

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Check, Command, Info, Mic, RotateCcw, Send, ShieldCheck, Sparkles, TriangleAlert, Undo2 } from "lucide-react";
import QuickReplyPalette, { type CannedReply } from "@/components/platform/agent/QuickReplyPalette";
import VoiceInput from "@/components/platform/voice/VoiceInput";
import { focusRing } from "@/components/platform/agent/desk-ui";
import { api, ApiError, type StaffMe } from "@/lib/v2/client";
import { sendTyping } from "@/lib/nexconn-client";
import { typingThrottle } from "@/lib/v2/typing";
import type { PreviewResult, ThreadHead } from "@/lib/v2/desk-types";

type Props = {
  thread: ThreadHead;
  staff: StaffMe;
  drafts: RefObject<Map<string, string>>;
  onSent: (message: string) => void;
  onReopen: () => void;
};

type Preview = { text: string; data?: PreviewResult; error?: string };
type SendFailure = { status: number; message: string };

const DEBOUNCE_MS = 800;

// The reply box. The agent writes English; the preview shows exactly what the buyer will read and an English back-translation.
export default function Composer({ thread, staff, drafts, onSent, onReopen }: Props) {
  const id = thread.id;
  const [draft, setDraft] = useState(() => drafts.current.get(id) ?? "");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [sending, setSending] = useState(false);
  const [failure, setFailure] = useState<SendFailure | null>(null);
  const [sentNote, setSentNote] = useState<{ text: string; at: string } | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestNote, setSuggestNote] = useState("");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const buyerId = thread.buyer.id;
  const notifyTyping = useMemo(() => typingThrottle(() => sendTyping(buyerId)), [buyerId]);
  const trimmed = draft.trim();
  const resolved = thread.status === "resolved";
  const foreign = !resolved && staff.role !== "owner" && thread.assignedStaff !== null && thread.assignedStaff.id !== staff.id;
  const active = !resolved && !foreign;

  useEffect(() => {
    if (!trimmed || !active) return;
    let alive = true;
    const timer = setTimeout(() => {
      api<PreviewResult>(`/api/desk/threads/${id}/preview`, { method: "POST", json: { text: trimmed } })
        .then((data) => alive && setPreview({ text: trimmed, data }))
        .catch((err: unknown) => alive && setPreview({ text: trimmed, error: err instanceof Error ? err.message : "Translation is unavailable." }));
    }, DEBOUNCE_MS);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [trimmed, id, active, attempt]);

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active]);

  const settled = preview !== null && preview.text === trimmed;
  const ready = settled ? (preview.data ?? null) : null;
  const previewFailed = settled && preview.error !== undefined;
  const pending = trimmed !== "" && !settled;
  const translationFailed = previewFailed || failure?.status === 502;
  const canSend = active && trimmed !== "" && !sending && ready !== null && ready.numbersOk;

  function change(value: string) {
    setDraft(value);
    drafts.current.set(id, value);
    setFailure(null);
    setSentNote(null);
    if (active && value.trim() !== "") notifyTyping();
  }

  async function send(sendOriginal: boolean) {
    if (!active || trimmed === "" || sending) return;
    setSending(true);
    setFailure(null);
    try {
      await api(`/api/desk/threads/${id}/reply`, {
        method: "POST",
        json: { text: trimmed, sendOriginal, translation: !sendOriginal && ready && !ready.sameLanguage ? ready.translated : undefined },
      });
      drafts.current.delete(id);
      setDraft("");
      setPreview(null);
      // The confirmation stays above the reply box until the next message is typed, so it cannot be missed.
      setSentNote({
        text: sendOriginal ? "Original message sent without translation." : "Your reply was sent. The buyer reads it in their language.",
        at: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      });
      onSent("");
    } catch (err) {
      setFailure({ status: err instanceof ApiError ? err.status : 0, message: err instanceof Error ? err.message : "The reply could not be sent." });
    } finally {
      setSending(false);
    }
  }

  async function suggest() {
    setSuggesting(true);
    setSuggestNote("");
    try {
      const r = await api<{ draft: string; note?: string }>(`/api/desk/threads/${id}/suggest`, { method: "POST" });
      change(r.draft);
      setSuggestNote(r.note ?? "");
      inputRef.current?.focus();
    } catch (err) {
      setSuggestNote(err instanceof Error ? err.message : "A reply could not be drafted.");
    } finally {
      setSuggesting(false);
    }
  }

  function insert(reply: CannedReply) {
    change(draft ? `${draft.trimEnd()} ${reply.body}` : reply.body);
    setPaletteOpen(false);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  if (resolved) {
    return (
      <div data-testid="composer-resolved" className="m-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-700 bg-[#111827] p-3">
        <p className="text-sm text-slate-300">This conversation is resolved, so replies are turned off. Reopen it if the buyer needs more help.</p>
        <button type="button" onClick={onReopen} data-testid="composer-reopen-btn" className={`inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-2 text-sm font-medium text-slate-100 hover:bg-slate-700 ${focusRing}`}>
          <Undo2 className="h-4 w-4" aria-hidden="true" /> Reopen
        </button>
      </div>
    );
  }
  if (foreign) {
    return (
      <p data-testid="composer-foreign" className="m-4 rounded-xl border border-slate-700 bg-[#111827] p-3 text-sm text-slate-300">
        This conversation is assigned to {thread.assignedStaff?.name}. Only that agent or the shop owner can reply. Ask them to transfer it to you.
      </p>
    );
  }

  const language = thread.language ?? "their language";

  return (
    <div className="p-4" data-testid="composer">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <button type="button" onClick={suggest} disabled={suggesting} data-testid="suggest-reply-btn" className={`inline-flex items-center gap-1.5 rounded-full border border-violet-400/30 bg-violet-500/10 px-3 py-1.5 text-xs font-medium text-violet-100 hover:bg-violet-500/20 disabled:opacity-60 ${focusRing}`}>
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          {suggesting ? "Drafting a reply" : "Suggest a reply"}
        </button>
        <button type="button" onClick={() => setPaletteOpen(true)} data-testid="quick-reply-btn" aria-label="Open saved replies (Ctrl or Cmd plus K)" className={`inline-flex items-center gap-1.5 rounded-full bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 ${focusRing}`}>
          <Command className="h-3.5 w-3.5" aria-hidden="true" /> Saved replies
        </button>
        {suggestNote && (
          <span role="status" data-testid="suggest-note" className="text-xs text-amber-300">
            {suggestNote}
          </span>
        )}
      </div>

      {voiceOpen && (
        <div className="mb-2">
          <VoiceInput
            languageHint="en"
            confirmLabel="Use as reply"
            onClose={() => setVoiceOpen(false)}
            onConfirm={({ text }) => {
              change(draft.trim() ? `${draft.trimEnd()} ${text}` : text);
              inputRef.current?.focus();
            }}
          />
        </div>
      )}
      {sentNote && (
        <p role="status" data-testid="reply-sent-note" className="mb-2 flex items-center gap-2 rounded-xl border border-emerald-400/50 bg-emerald-500/15 px-3 py-2.5 text-sm font-semibold text-emerald-100">
          <Check className="h-5 w-5 shrink-0 text-emerald-300" aria-hidden="true" />
          <span className="min-w-0 flex-1">{sentNote.text}</span>
          <span className="shrink-0 font-mono text-xs font-normal text-emerald-200/80">{sentNote.at}</span>
        </p>
      )}
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <label htmlFor="reply-input" className="sr-only">
            Reply in English. The buyer reads {language}.
          </label>
          <textarea
            id="reply-input"
            ref={inputRef}
            rows={2}
            value={draft}
            onChange={(e) => change(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                if (canSend) void send(false);
              }
            }}
            placeholder={`Reply in English. The buyer reads ${language}.`}
            data-testid="reply-input"
            className={`w-full resize-none rounded-xl border border-slate-700 bg-[#0B0F17] px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 ${focusRing}`}
          />
        </div>
        <div className="flex shrink-0 flex-col gap-1.5">
          <button type="button" onClick={() => setVoiceOpen((o) => !o)} aria-pressed={voiceOpen} aria-label={voiceOpen ? "Close voice input" : "Dictate a reply by voice"} title="Dictate a reply by voice" data-testid="mic-btn" className={`rounded-lg p-2.5 ${voiceOpen ? "bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-400/40" : "bg-slate-800 text-slate-300 hover:bg-slate-700"} ${focusRing}`}>
            <Mic className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => void send(false)} disabled={!canSend} data-testid="reply-send-btn" className={`inline-flex items-center justify-center gap-1.5 rounded-lg bg-indigo-500 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-45 ${focusRing}`}>
            <Send className="h-4 w-4" aria-hidden="true" /> {sending ? "Sending" : "Send"}
          </button>
        </div>
      </div>
      <p className="mt-1.5 text-[11px] text-slate-500" data-testid="composer-hint">
        Enter sends. Shift+Enter adds a line. Ctrl/Cmd+K opens saved replies.
      </p>

      {failure && failure.status !== 502 && (
        <p role="alert" data-testid="reply-error" className="mt-2 rounded-lg bg-red-500/10 p-2 text-xs text-red-200 ring-1 ring-red-400/30">
          {failure.message}
        </p>
      )}

      <div data-testid="back-translation-panel" className="mt-3 rounded-xl border border-slate-700 bg-[#111827] p-3">
        <p className="flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-slate-400">
          <ShieldCheck className="h-3.5 w-3.5 text-cyan-400" aria-hidden="true" /> Back-translation check
        </p>
        {trimmed === "" ? (
          <p className="mt-1.5 text-sm text-slate-400" data-testid="back-translation-empty">
            Type a reply or pick a suggestion. Before you send, you will see exactly what the buyer will read in {language}, with an English back-translation.
          </p>
        ) : translationFailed ? (
          <div role="alert" data-testid="translation-failed" className="mt-2 rounded-lg bg-amber-400/10 p-3 ring-1 ring-amber-400/30">
            <p className="flex items-start gap-1.5 text-sm font-medium text-amber-200">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              Translation is unavailable. Your reply is saved in the box. Retry or Send original.
            </p>
            <p className="mt-1 text-xs text-amber-100/80">Send original delivers your English text without translation. The buyer may not understand it.</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setPreview(null);
                  setFailure(null);
                  setAttempt((n) => n + 1);
                }}
                data-testid="translation-retry-btn"
                className={`inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-100 hover:bg-slate-700 ${focusRing}`}
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> Retry
              </button>
              <button type="button" onClick={() => void send(true)} disabled={sending} data-testid="send-original-btn" className={`inline-flex items-center gap-1.5 rounded-lg bg-amber-500/20 px-3 py-1.5 text-xs font-medium text-amber-100 hover:bg-amber-500/30 disabled:opacity-50 ${focusRing}`}>
                <Send className="h-3.5 w-3.5" aria-hidden="true" /> Send original
              </button>
            </div>
          </div>
        ) : pending || !ready ? (
          <p role="status" data-testid="back-translation-loading" className="mt-1.5 text-sm text-slate-400">
            Checking the translation...
          </p>
        ) : ready.sameLanguage ? (
          <p data-testid="same-language-note" className="mt-1.5 flex items-start gap-1.5 text-sm text-slate-300">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400" aria-hidden="true" />
            The buyer writes in English, so your message is sent as written.
          </p>
        ) : (
          <div className="mt-2 space-y-2.5">
            <div>
              <p className="text-[11px] font-semibold text-slate-400">The buyer will read ({ready.language}):</p>
              <p dir="auto" data-testid="customer-will-read" className="mt-1 rounded-lg bg-cyan-400/5 p-2 text-sm text-slate-100 ring-1 ring-cyan-400/20">
                {ready.translated}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-400">English back-translation:</p>
              <p lang="en" data-testid="english-back-translation" className="mt-1 text-sm text-slate-300">
                {ready.backTranslated ?? "The back-translation is unavailable. Compare the translation above before sending."}
              </p>
            </div>
            {ready.numbersOk ? (
              <p data-testid="numbers-verified-ok" className="flex items-center gap-1.5 text-xs font-medium text-emerald-300">
                <Check className="h-3.5 w-3.5" aria-hidden="true" /> Numbers verified{ready.numbers && ready.numbers.checked.length > 0 ? `: ${ready.numbers.checked.join(", ")} kept exactly` : ""}
              </p>
            ) : (
              <div data-testid="numbers-warning" role="alert" className="rounded-lg bg-amber-400/10 p-2 ring-1 ring-amber-400/30">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-300">
                  <TriangleAlert className="h-3.5 w-3.5" aria-hidden="true" /> The translation changed a number
                </p>
                <p className="mt-0.5 text-xs text-amber-200">
                  {ready.numbers && (ready.numbers.missing.length > 0 || ready.numbers.added.length > 0)
                    ? `${ready.numbers.missing.length > 0 ? `Lost: ${ready.numbers.missing.join(", ")}. ` : ""}${ready.numbers.added.length > 0 ? `Added: ${ready.numbers.added.join(", ")}. ` : ""}`
                    : ""}
                  Sending is off. Reword the message, or retry the translation.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setPreview(null);
                    setAttempt((n) => n + 1);
                  }}
                  data-testid="numbers-retry-btn"
                  className={`mt-1.5 inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs text-slate-100 hover:bg-slate-700 ${focusRing}`}
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> Retry translation
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {paletteOpen && (
        <QuickReplyPalette
          onPick={insert}
          onClose={() => {
            setPaletteOpen(false);
            requestAnimationFrame(() => inputRef.current?.focus());
          }}
        />
      )}
    </div>
  );
}
