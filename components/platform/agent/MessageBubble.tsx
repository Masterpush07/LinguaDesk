"use client";

import { Languages, ShieldCheck, Sparkles, Volume2 } from "lucide-react";
import { formatClockTime, formatUsd } from "@/lib/v2/desk-client";
import type { DeskMessage } from "@/lib/v2/desk-types";

type Props = {
  message: DeskMessage;
  buyerLanguage: string | null;
  swapped: boolean; // true: the buyer's language is the large text
};

function OrderBlock({ order }: { order: NonNullable<DeskMessage["order"]> }) {
  return (
    <div data-testid={`order-card-${order.id}`} className="mt-2 rounded-lg bg-black/20 p-2.5 text-[13px]">
      <ul className="space-y-0.5">
        {order.lines.map((l, i) => (
          <li key={`${l.name}-${i}`} className="flex justify-between gap-3">
            <span className="min-w-0 break-words">
              {l.qty} x {l.name}
            </span>
            <span className="tabular-nums">{formatUsd(l.amount)}</span>
          </li>
        ))}
      </ul>
      <div className="mt-1.5 flex justify-between border-t border-white/20 pt-1.5 text-white/80">
        <span>{order.labels.shipping}</span>
        <span className="tabular-nums">{order.shipping === 0 ? order.labels.free : formatUsd(order.shipping)}</span>
      </div>
      <div className="flex justify-between font-semibold">
        <span>{order.labels.total}</span>
        <span className="tabular-nums">{formatUsd(order.total)}</span>
      </div>
    </div>
  );
}

// One chat bubble. Team messages are right-aligned; buyer and AI messages carry both the original and the English version.
export default function MessageBubble({ message: m, buyerLanguage, swapped }: Props) {
  if (m.sender === "system") {
    return (
      <p data-testid={`message-${m.id}`} className="text-center text-xs text-slate-500">
        {m.text}
      </p>
    );
  }
  const mine = m.sender === "staff";
  const ai = m.sender === "ai";
  // Original text is what the buyer wrote or received; English is what the team wrote or read.
  const original = m.text;
  const english = m.textEn;
  const hasBoth = english !== null && english.trim() !== original.trim();
  const large = hasBoth && !swapped ? english : original;
  const small = hasBoth ? (large === original ? english : original) : null;

  const bubble = mine
    ? "bg-indigo-600 text-white"
    : ai
      ? "bg-violet-500/10 text-slate-100 ring-1 ring-violet-400/30"
      : "bg-slate-800 text-slate-100";
  const sub = mine ? "text-indigo-100" : "text-slate-400";
  const who = mine ? (m.staffName ?? "Agent") : ai ? "AI assistant" : "Buyer";

  return (
    <div className={`flex flex-col ${mine ? "items-end" : "items-start"}`} data-testid={`message-${m.id}`}>
      <p className="mb-1 flex items-center gap-1 px-1 text-[11px] font-medium text-slate-400">
        {ai && <Sparkles className="h-3 w-3 text-violet-400" aria-hidden="true" />}
        {who}
      </p>
      <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[15px] leading-relaxed sm:max-w-[75%] ${bubble}`}>
        <p dir="auto" className="whitespace-pre-wrap break-words">
          {m.voiceSeconds ? <Volume2 className="mr-1.5 mb-0.5 inline h-3.5 w-3.5 opacity-80" aria-label="Voice message" /> : null}
          {large}
        </p>
        {m.order && <OrderBlock order={m.order} />}
        {small !== null && (
          <p className={`mt-1.5 flex items-start gap-1.5 border-t pt-1.5 text-[13px] ${mine ? "border-white/25" : "border-slate-700"} ${sub}`}>
            <span className="mt-0.5 shrink-0 rounded bg-black/20 px-1 font-mono text-[10px] uppercase tracking-wide">
              {small === english ? "EN" : (mine ? (buyerLanguage ?? "Sent") : (m.lang ?? buyerLanguage ?? "Original"))}
            </span>
            <span dir="auto" className="min-w-0 whitespace-pre-wrap break-words">
              {small}
            </span>
          </p>
        )}
        <div className={`mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] ${sub}`}>
          <time dateTime={m.createdAt}>{formatClockTime(m.createdAt)}</time>
          {hasBoth && (
            <span className="inline-flex items-center gap-1" title="This message was translated">
              <Languages className="h-3 w-3" aria-hidden="true" />
              Translated
            </span>
          )}
          {mine && m.numbersVerified && (
            <span data-testid="numbers-verified" className="inline-flex items-center gap-1 text-emerald-200">
              <ShieldCheck className="h-3 w-3" aria-hidden="true" />
              Numbers verified
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
