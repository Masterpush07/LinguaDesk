"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Languages, Mic, RefreshCw, Send, Store, Wifi, WifiOff } from "lucide-react";
import VoiceInput from "@/components/platform/voice/VoiceInput";
import PushToggle from "@/components/platform/PushToggle";
import SelectionChip from "./SelectionChip";
import { usePrefs } from "@/components/platform/Prefs";
import { LangBadge } from "@/components/platform/ui";
import { connect, onConnection, onMessage, sendText, type Session } from "@/lib/nexconn-client";
import { LANGS } from "@/lib/platform/data";
import type { LangCode } from "@/lib/platform/types";
import { api, ApiError } from "@/lib/v2/client";
import type { BuyerThreadView } from "@/lib/v2/buyer-types";
import BuyerBubble from "./BuyerBubble";
import { chipText, orderText, type ChipKey } from "./chips";
import { FOCUS, OrderCardView, ProductBar, SendFailedPanel, StatusBanner, TypingIndicator } from "./ChatParts";
import EmailNotify from "./EmailNotify";

const TYPING_MAX_MS = 25_000;
const SLOW_REFRESH_MS = 15_000;
const CHIP_KEYS: ChipKey[] = ["price", "ship", "returns"];

type Pending = { id: string; text: string; state: "sending" | "sent" | "failed"; createdAt: string };
type Phase = "starting" | "ready" | "error";

const isKnown = (code: string): code is LangCode => code in LANGS;

// One session request per page load: React dev mode runs effects twice and a second request would create a second guest identity.
let sessionRequest: Promise<Session> | null = null;
function startSession(): Promise<Session> {
  sessionRequest ??= api<Session>("/api/buyer/session", { method: "POST" }).catch((err: unknown) => {
    sessionRequest = null;
    throw err;
  });
  return sessionRequest;
}

export default function BuyerChat({ slug }: { slug: string }) {
  const { language } = usePrefs();
  const params = useSearchParams();
  const productParam = params.get("product");
  const orderIntent = params.get("intent") === "order";
  const itemParam = params.get("item");
  const qtyParam = params.get("qty");
  const colourParam = params.get("colour");
  const sizeParam = params.get("size");

  const [phase, setPhase] = useState<Phase>("starting");
  const [error, setError] = useState<{ message: string; missing: boolean } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [view, setView] = useState<BuyerThreadView | null>(null);
  const [pending, setPending] = useState<Pending[]>([]);
  const [draft, setDraft] = useState("");
  const [reading, setReading] = useState<"buyer" | "english">("buyer");
  const [connected, setConnected] = useState<boolean | null>(null);
  const [awaiting, setAwaiting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [orderBusy, setOrderBusy] = useState<string | null>(null);
  const [orderError, setOrderError] = useState<{ id: string; message: string } | null>(null);
  const [voiceOpen, setVoiceOpen] = useState(false);

  const threadIdRef = useRef<string | null>(null);
  const viewRef = useRef<BuyerThreadView | null>(null);
  const linkRef = useRef<Promise<string> | null>(null);
  const localSeq = useRef(0);
  const requestSeq = useRef(0);
  const appliedSeq = useRef(0);
  const timers = useRef<number[]>([]);
  const awaitTimer = useRef<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const list = timers.current;
    return () => {
      list.forEach((id) => window.clearTimeout(id));
      if (awaitTimer.current !== null) window.clearTimeout(awaitTimer.current);
    };
  }, []);

  const stopAwait = useCallback(() => {
    if (awaitTimer.current !== null) window.clearTimeout(awaitTimer.current);
    awaitTimer.current = null;
    setAwaiting(false);
  }, []);

  const startAwait = useCallback((ms: number) => {
    if (awaitTimer.current !== null) window.clearTimeout(awaitTimer.current);
    setAwaiting(true);
    awaitTimer.current = window.setTimeout(() => {
      awaitTimer.current = null;
      setAwaiting(false);
    }, ms);
  }, []);

  // Applies a fresh server view: drops optimistic bubbles that are now stored and decides whether the AI is still expected to answer.
  const applyView = useCallback(
    (next: BuyerThreadView) => {
      viewRef.current = next;
      setView(next);
      const stored = next.messages;
      const ids = new Set(stored.map((m) => m.id));
      setPending((prev) => {
        const used = new Set<string>();
        return prev.filter((p) => {
          if (ids.has(p.id)) return false;
          if (p.state !== "sent") return true;
          const twin = stored.find((m) => m.sender === "buyer" && m.text === p.text && !used.has(m.id) && Date.parse(m.createdAt) >= Date.parse(p.createdAt) - 5000);
          if (twin) used.add(twin.id);
          return !twin;
        });
      });
      const last = stored.at(-1);
      if (next.thread.status !== "ai" || (last && last.sender !== "buyer")) stopAwait();
      else if (last && Date.now() - Date.parse(last.createdAt) < TYPING_MAX_MS) startAwait(TYPING_MAX_MS - (Date.now() - Date.parse(last.createdAt)));
    },
    [startAwait, stopAwait],
  );

  const refresh = useCallback(async () => {
    const id = threadIdRef.current;
    if (!id) return;
    const seq = ++requestSeq.current;
    try {
      // A hidden tab still reloads when a message arrives, but must not count as the buyer being present.
      const hidden = document.visibilityState === "hidden" ? "?hidden=1" : "";
      const next = await api<BuyerThreadView>(`/api/buyer/threads/${id}${hidden}`);
      if (seq < appliedSeq.current) return;
      appliedSeq.current = seq;
      applyView(next);
    } catch {
      // the next refresh retries; the conversation already on screen stays visible
    }
  }, [applyView]);

  // The webhook stores the AI reply a moment after it is sent, so look again shortly and once more a few seconds later.
  const refreshSoon = useCallback(() => {
    timers.current.push(window.setTimeout(() => void refresh(), 600), window.setTimeout(() => void refresh(), 4000));
  }, [refresh]);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const session = await startSession();
        if (!alive) return;
        const link = connect(session);
        linkRef.current = link;
        link.then(
          () => alive && setConnected(true),
          () => alive && setConnected(false),
        );
        const qty = qtyParam && /^\d{1,2}$/.test(qtyParam) ? Number(qtyParam) : undefined;
        const selection = productParam && (colourParam || qty) ? { colour: colourParam ?? undefined, qty } : undefined;
        const first = await api<BuyerThreadView>("/api/buyer/threads", { method: "POST", json: { sellerSlug: slug, productId: productParam ?? undefined, selection } });
        if (!alive) return;
        threadIdRef.current = first.thread.id;
        applyView(first);
        setPhase("ready");
      } catch (err) {
        if (!alive) return;
        setError({ message: err instanceof Error ? err.message : "Something went wrong.", missing: err instanceof ApiError && err.status === 404 });
        setPhase("error");
      }
    })();
    return () => {
      alive = false;
    };
  }, [attempt, slug, productParam, colourParam, qtyParam, applyView]);

  useEffect(() => {
    if (phase !== "ready") return;
    const offMessage = onMessage(() => refreshSoon());
    const offConnection = onConnection((up) => setConnected(up));
    const onFocus = () => void refresh();
    const slow = window.setInterval(() => document.visibilityState === "visible" && void refresh(), SLOW_REFRESH_MS);
    window.addEventListener("focus", onFocus);
    // Leaving the tab or closing the page says so at once (sendBeacon survives the page closing), so the shop's reply
    // alerts the buyer right away instead of after a wait; coming back says so too.
    const away = () => navigator.sendBeacon?.("/api/buyer/presence", new Blob([JSON.stringify({ state: "away" })], { type: "application/json" }));
    const onVisibility = () => (document.visibilityState === "hidden" ? away() : void refresh());
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", away);
    return () => {
      offMessage();
      offConnection();
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", away);
      window.clearInterval(slow);
    };
  }, [phase, refresh, refreshSoon]);

  useEffect(() => {
    if (!awaiting) return;
    const id = window.setInterval(() => void refresh(), 3000);
    return () => window.clearInterval(id);
  }, [awaiting, refresh]);

  const messages = view?.messages ?? [];
  const status = view?.thread.status ?? "ai";
  const hasEnglish = messages.some((m) => m.textEn && m.textEn !== m.text);
  const lastPending = pending.at(-1);
  const lastIsBuyer = lastPending ? lastPending.state !== "failed" : messages.at(-1)?.sender === "buyer";
  const typing = awaiting && status === "ai" && lastIsBuyer;

  // The product page's order button passes the buyer's choices; they are written into the message box once, for the buyer to edit and send.
  const prefilled = useRef(false);
  useEffect(() => {
    if (phase !== "ready" || prefilled.current || !orderIntent || !itemParam) return;
    prefilled.current = true;
    const clean = (v: string | null) => (v ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, 60);
    const qty = Math.min(20, Math.max(1, Math.floor(Number(qtyParam)) || 1));
    const options = [clean(colourParam), clean(sizeParam)].filter(Boolean);
    setDraft((current) => current || orderText(language, clean(itemParam), qty, options));
    composerRef.current?.focus();
  }, [phase, orderIntent, itemParam, qtyParam, colourParam, sizeParam, language]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({ top: el.scrollHeight, behavior: reduce ? "auto" : "smooth" });
  }, [messages.length, pending.length, typing, status]);

  const toggleReading = useCallback(() => {
    if (hasEnglish) setReading((v) => (v === "buyer" ? "english" : "buyer"));
  }, [hasEnglish]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      const key = e.key.toLowerCase();
      if (key === "t" && !e.shiftKey) {
        e.preventDefault();
        toggleReading();
      } else if (key === "v" && e.shiftKey && !voiceOpen) {
        e.preventDefault();
        setVoiceOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleReading, voiceOpen]);

  const send = useCallback(
    async (text: string, retryId?: string) => {
      const target = viewRef.current?.seller.nexconnUserId;
      if (!target) return;
      const id = retryId ?? `local-${++localSeq.current}`;
      setNotice(null);
      if (retryId) setPending((prev) => prev.map((p) => (p.id === id ? { ...p, state: "sending" } : p)));
      else setPending((prev) => [...prev, { id, text, state: "sending", createdAt: new Date().toISOString() }]);
      try {
        await linkRef.current;
        const sent = await sendText(target, text);
        setPending((prev) => prev.map((p) => (p.id === id ? { ...p, id: sent.id, state: "sent" } : p)));
        if (viewRef.current?.thread.status !== "waiting" && viewRef.current?.thread.status !== "assigned") startAwait(TYPING_MAX_MS);
        refreshSoon();
      } catch {
        setPending((prev) => prev.map((p) => (p.id === id ? { ...p, state: "failed" } : p)));
      }
    },
    [refreshSoon, startAwait],
  );

  function submitDraft() {
    const text = draft.trim();
    if (!text || phase !== "ready") return;
    setDraft("");
    void send(text);
  }

  async function run(action: () => Promise<BuyerThreadView | void>) {
    setBusy(true);
    setNotice(null);
    try {
      const next = await action();
      if (next) applyView(next);
      else await refresh();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "That did not work. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const threadPath = view ? `/api/buyer/threads/${view.thread.id}` : "";
  const handoff = () => void run(() => api<BuyerThreadView>(`${threadPath}/handoff`, { method: "POST", json: {} }));
  const cancelHandoff = () => void run(() => api<BuyerThreadView>(`${threadPath}/handoff`, { method: "DELETE" }));
  const rate = (rating: number) => void run(() => api<unknown>(`${threadPath}/rate`, { method: "POST", json: { rating } }).then(() => undefined));

  async function confirmOrder(orderId: string) {
    setOrderBusy(orderId);
    setOrderError(null);
    try {
      await api<{ ok: boolean }>(`/api/buyer/orders/${encodeURIComponent(orderId)}/confirm`, { method: "POST", json: {} });
      await refresh();
      refreshSoon();
    } catch (err) {
      setOrderError({ id: orderId, message: err instanceof Error ? err.message : "The order could not be confirmed. Please try again." });
    } finally {
      setOrderBusy(null);
    }
  }

  function copyText(text: string) {
    void navigator.clipboard?.writeText(text).catch(() => undefined);
    setNotice("The text was copied.");
  }

  if (phase === "starting") {
    return (
      <div role="status" data-testid="chat-loading" className="flex min-h-0 flex-1 items-center justify-center bg-slate-50 text-sm text-slate-500">
        Opening your conversation...
      </div>
    );
  }

  if (phase === "error" || !view) {
    return (
      <div data-testid="chat-error" role="alert" className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 bg-slate-50 px-6 text-center">
        <p className="font-heading text-lg font-semibold text-slate-900">{error?.missing ? "This shop could not be found" : "We could not open this conversation"}</p>
        <p className="max-w-md text-sm text-slate-600">{error?.missing ? "The link may be out of date. Browse the marketplace to find the shop again." : error?.message}</p>
        <div className="flex gap-2">
          {!error?.missing && (
            <button
              type="button"
              onClick={() => {
                setPhase("starting");
                setAttempt((n) => n + 1);
              }}
              data-testid="chat-retry-btn"
              className={`inline-flex items-center gap-1.5 rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 ${FOCUS}`}
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" /> Try again
            </button>
          )}
          <Link href="/marketplace" data-testid="chat-error-marketplace-link" className={`rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 ${FOCUS}`}>
            Browse the marketplace
          </Link>
        </div>
      </div>
    );
  }

  const { seller, product } = view;
  const rtl = LANGS[language].rtl;
  const showChips = messages.length === 0 && pending.length === 0 && status === "ai";

  return (
    <div data-testid="buyer-chat" className="flex min-h-0 flex-1 flex-col bg-slate-50">
      <header data-testid="chat-header" className="border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-x-3 gap-y-2">
          <Link href="/chats" aria-label="Back to all conversations" data-testid="chat-back-link" className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 ${FOCUS}`}>
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </Link>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-100 to-cyan-100 text-indigo-700" aria-hidden="true">
            <Store className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1 basis-48">
            <div className="flex flex-wrap items-center gap-2">
              <h1 data-testid="chat-seller-name" className="font-heading text-base font-semibold text-slate-900">
                {seller.name}
              </h1>
              <span
                data-testid="chat-online-status"
                className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${seller.teamOnline ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${seller.teamOnline ? "bg-emerald-500" : "bg-slate-400"}`} />
                {seller.teamOnline ? "Shop team online" : `Team away, ${seller.assistantName} replies`}
              </span>
              <span
                data-testid="chat-connection-status"
                role="status"
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${connected ? "bg-slate-100 text-slate-600" : "bg-amber-50 text-amber-800"}`}
              >
                {connected ? <Wifi className="h-3 w-3" aria-hidden="true" /> : <WifiOff className="h-3 w-3" aria-hidden="true" />}
                {connected ? "Connected" : connected === null ? "Connecting" : "Offline"}
              </span>
              {connected === false && (
                <button type="button" onClick={() => window.location.reload()} data-testid="chat-reconnect-btn" className={`rounded-full px-2 py-0.5 text-[11px] font-medium text-indigo-700 hover:bg-indigo-50 ${FOCUS}`}>
                  Reconnect
                </button>
              )}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 max-sm:hidden" data-testid="chat-languages">
              {seller.country && <span className="text-xs text-slate-500">{seller.country}</span>}
              {seller.languages.filter(isKnown).map((c) => (
                <LangBadge key={c} code={c} />
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={toggleReading}
            disabled={!hasEnglish}
            aria-pressed={reading === "english"}
            data-testid="translate-toggle-btn"
            title={hasEnglish ? "Switch which language is shown large (Ctrl/Cmd+T)" : "No translations to switch yet"}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS}`}
          >
            <Languages className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="max-sm:sr-only">{reading === "buyer" ? "Show English first" : "Show my language first"}</span>
          </button>
        </div>
      </header>

      {product && <ProductBar product={product} sellerSlug={seller.slug} />}
      {product && view.selection && (
        <div className="border-b border-slate-200 bg-slate-50 px-4 pb-2 sm:px-6">
          <div className="mx-auto max-w-3xl">
            <SelectionChip selection={view.selection} />
          </div>
        </div>
      )}
      <StatusBanner
        view={view}
        busy={busy}
        onHandoff={handoff}
        onCancel={cancelHandoff}
        onRate={rate}
        onNewQuestion={() => composerRef.current?.focus()}
      />
      {(status === "waiting" || status === "assigned") && (
        <div data-testid="chat-waiting-notify" className="border-b border-slate-200 bg-white px-4 pb-3 sm:px-6">
          <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-x-3 gap-y-2">
            <p className="text-sm text-slate-600">Get notified when the shop replies</p>
            <PushToggle audience="buyer" compact />
          </div>
          <EmailNotify />
        </div>
      )}
      {notice && (
        <p role="status" data-testid="chat-notice" className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-900 sm:px-6">
          {notice}
        </p>
      )}

      <div ref={scrollRef} role="log" aria-label="Conversation" data-testid="chat-messages" className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          {messages.length === 0 && pending.length === 0 && (
            <div data-testid="chat-empty" className="rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-center">
              <p className="font-heading text-base font-semibold text-slate-900">Start your conversation with {seller.name}</p>
              <p className="mt-1 text-sm text-slate-600">Write in your own language. Replies are translated for you, and you can show the English version at any time.</p>
            </div>
          )}

          {messages.map((m) => (
            <div key={m.id} className="flex flex-col gap-2">
              <BuyerBubble message={m} view={reading} assistantName={seller.assistantName} />
              {m.order && m.orderId && (
                <div className="flex justify-start">
                  <OrderCardView
                    order={m.order}
                    orderId={m.orderId}
                    status={m.orderStatus}
                    busy={orderBusy === m.orderId}
                    error={orderError?.id === m.orderId ? orderError.message : null}
                    onConfirm={(id) => void confirmOrder(id)}
                  />
                </div>
              )}
            </div>
          ))}

          {pending.map((p) => (
            <div key={p.id} className="flex flex-col items-end gap-2">
              <BuyerBubble
                message={{ id: p.id, sender: "buyer", text: p.text, textEn: null, lang: null, voiceSeconds: null, numbersVerified: false, confidence: null, createdAt: p.createdAt, staffName: null, order: null, orderId: null, orderStatus: null }}
                view={reading}
                delivery={p.state === "sending" ? "sending" : p.state === "failed" ? "failed" : undefined}
              />
              {p.state === "failed" && (
                <SendFailedPanel
                  id={p.id}
                  text={p.text}
                  onRetry={() => void send(p.text, p.id)}
                  onCopy={() => copyText(p.text)}
                  onDiscard={() => setPending((prev) => prev.filter((x) => x.id !== p.id))}
                />
              )}
            </div>
          ))}

          {showChips && (
            <div data-testid="starter-chips" className="flex flex-col gap-2">
              <p className="text-xs font-medium text-slate-500">Suggested questions</p>
              <div className="flex flex-wrap gap-2">
                {CHIP_KEYS.filter((k) => k !== "price" || product).map((k) => {
                  const text = chipText(k, language, product?.name ?? null);
                  return (
                    <button
                      key={k}
                      type="button"
                      lang={language}
                      dir={rtl ? "rtl" : "auto"}
                      onClick={() => void send(text)}
                      data-testid={`starter-chip-${k}`}
                      className={`rounded-full border border-indigo-200 bg-white px-3.5 py-2 text-sm text-indigo-700 transition hover:bg-indigo-50 motion-reduce:transition-none ${FOCUS}`}
                    >
                      {text}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {typing && <TypingIndicator label={`${seller.assistantName} is typing`} />}
        </div>
      </div>

      <div className="border-t border-slate-200 bg-white px-4 py-3 sm:px-6">
        <div className="mx-auto max-w-3xl space-y-2">
          {voiceOpen && (
            <VoiceInput
              confirmLabel="Send message"
              onClose={() => setVoiceOpen(false)}
              onConfirm={async ({ text }) => {
                await send(text);
              }}
            />
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitDraft();
            }}
            className="flex items-end gap-2 rounded-2xl border border-slate-300 bg-white p-2 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/30"
          >
            <label htmlFor="chat-composer-input" className="sr-only">
              Message to {seller.name}
            </label>
            <textarea
              id="chat-composer-input"
              ref={composerRef}
              data-testid="chat-composer-input"
              rows={1}
              lang={language}
              dir={rtl ? "rtl" : "auto"}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  submitDraft();
                }
              }}
              placeholder="Write your message in any language"
              className="max-h-32 min-h-9 flex-1 resize-none bg-transparent px-2 py-1.5 text-[15px] text-slate-900 placeholder:text-slate-400 [field-sizing:content] focus-visible:outline-none"
            />
            <button
              type="button"
              onClick={() => setVoiceOpen((o) => !o)}
              aria-pressed={voiceOpen}
              aria-label={voiceOpen ? "Close voice message" : "Record a voice message (Ctrl/Cmd+Shift+V)"}
              data-testid="voice-toggle-btn"
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition motion-reduce:transition-none ${voiceOpen ? "bg-cyan-50 text-cyan-700 ring-1 ring-cyan-300" : "text-slate-600 hover:bg-slate-100"} ${FOCUS}`}
            >
              <Mic className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="submit"
              disabled={!draft.trim()}
              aria-label="Send message"
              data-testid="send-btn"
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white transition hover:bg-indigo-700 motion-reduce:transition-none disabled:cursor-not-allowed disabled:bg-slate-300 ${FOCUS}`}
            >
              <Send className="h-4 w-4" aria-hidden="true" />
            </button>
          </form>
          <p data-testid="composer-hint" className="hidden text-[11px] text-slate-500 sm:block">
            Enter to send. Shift+Enter for a new line. Ctrl/Cmd+T switch language. Ctrl/Cmd+Shift+V voice message.
          </p>
        </div>
      </div>
    </div>
  );
}
