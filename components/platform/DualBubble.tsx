"use client";

import { Languages, ShieldCheck, TriangleAlert, Volume2 } from "lucide-react";
import { AiBadge, LangBadge } from "@/components/platform/ui";
import { LANGS } from "@/lib/platform/data";
import type { Msg } from "@/lib/platform/types";

type Props = {
  msg: Msg;
  mine: boolean; // right-aligned, brand-coloured bubble
  primary: "original" | "translated"; // which text is the large one
  showOther?: boolean; // show the other version underneath
  dark?: boolean;
  onPlay?: (text: string, lang: Msg["target_lang"]) => void;
};

// A chat bubble that always carries both the original text and its translation.
export default function DualBubble({ msg, mine, primary, showOther = true, dark = false, onPlay }: Props) {
  const main = primary === "original" ? { text: msg.original_text, lang: msg.original_lang } : { text: msg.translated_text, lang: msg.target_lang };
  const other = primary === "original" ? { text: msg.translated_text, lang: msg.target_lang } : { text: msg.original_text, lang: msg.original_lang };
  const aiStyle = msg.is_ai_generated;
  const low = msg.confidence_score < 0.9;

  const bubble = mine
    ? "bg-indigo-600 text-white"
    : aiStyle
      ? dark
        ? "bg-violet-500/10 text-slate-100 ring-1 ring-violet-400/30"
        : "bg-violet-50 text-slate-900 ring-1 ring-violet-200"
      : dark
        ? "bg-slate-800 text-slate-100"
        : "bg-indigo-50 text-indigo-950";

  const sub = mine ? "text-indigo-100" : dark ? "text-slate-400" : "text-slate-500";
  const rule = mine ? "border-white/25" : dark ? "border-slate-700" : "border-indigo-200/70";

  return (
    <div className={`flex flex-col ${mine ? "items-end" : "items-start"}`} data-testid={`message-${msg.id}`}>
      {aiStyle && (
        <div className="mb-1 px-1">
          <AiBadge dark={dark} />
        </div>
      )}
      <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[15px] leading-relaxed sm:max-w-[75%] ${bubble}`}>
        <p lang={main.lang} dir={LANGS[main.lang].rtl ? "rtl" : "auto"} className="whitespace-pre-wrap break-words">
          {msg.voice_seconds ? <Volume2 className="mr-1.5 mb-0.5 inline h-3.5 w-3.5 opacity-80" aria-label="Voice message" /> : null}
          {main.text}
        </p>
        {showOther && other.text !== main.text && (
          <p lang={other.lang} dir={LANGS[other.lang].rtl ? "rtl" : "auto"} className={`mt-1.5 flex items-start gap-1.5 border-t pt-1.5 text-[13px] ${rule} ${sub}`}>
            <LangBadge code={other.lang} dark={dark || mine} className={mine ? "!bg-white/15 !text-white" : ""} />
            <span className="min-w-0 break-words">{other.text}</span>
          </p>
        )}
        <div className={`mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] ${sub}`}>
          <span>{msg.time}</span>
          {msg.original_lang !== msg.target_lang && (
            <span className="inline-flex items-center gap-1" title="Translation confidence">
              <Languages className="h-3 w-3" aria-hidden="true" />
              {Math.round(msg.confidence_score * 100)}%
            </span>
          )}
          {msg.numbersVerified && (
            <span data-testid="numbers-verified" className={`inline-flex items-center gap-1 ${mine ? "text-emerald-200" : dark ? "text-emerald-300" : "text-emerald-700"}`}>
              <ShieldCheck className="h-3 w-3" aria-hidden="true" />
              Numbers verified
            </span>
          )}
          {low && (
            <span className={`inline-flex items-center gap-1 ${mine ? "text-amber-200" : dark ? "text-amber-300" : "text-amber-700"}`}>
              <TriangleAlert className="h-3 w-3" aria-hidden="true" />
              Low confidence
            </span>
          )}
          {onPlay && (
            <button
              type="button"
              onClick={() => onPlay(msg.translated_text, msg.target_lang)}
              aria-label="Listen to the translated message"
              data-testid={`play-${msg.id}`}
              className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
            >
              <Volume2 className="h-3 w-3" aria-hidden="true" />
              Listen
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export const BCP47: Record<string, string> = { en: "en-US", es: "es-ES", ja: "ja-JP", hi: "hi-IN", ar: "ar-SA", fr: "fr-FR", ta: "ta-IN", pt: "pt-BR", ko: "ko-KR", zh: "zh-CN" };

// Browser text-to-speech. Voices vary by device, so this is a best-effort extra and silently does nothing if unsupported.
export function speak(text: string, lang: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = BCP47[lang] ?? "en-US";
  window.speechSynthesis.speak(u);
}
