"use client";

import { useState } from "react";
import { Flag, Languages, ShieldCheck, Volume2 } from "lucide-react";
import { speak } from "@/components/platform/DualBubble";
import { AiBadge } from "@/components/platform/ui";
import { LANGS } from "@/lib/platform/data";
import type { LangCode } from "@/lib/platform/types";
import type { BuyerMessage } from "@/lib/v2/buyer-types";
import { REPORT_COMMENT_MAX, REPORT_REASON_LABEL, REPORT_REASONS, type ReportReason } from "@/lib/v2/translation-report";

export type Delivery = "sending" | "failed";

type Props = {
  message: BuyerMessage;
  view: "buyer" | "english";
  delivery?: Delivery;
  assistantName?: string; // the shop's name for its AI assistant
  onReport?: (messageId: string, reason: ReportReason, comment: string) => Promise<void>; // lets the buyer flag a wrong translation
};

// The AI reports languages by name (for example "Spanish"), the shop UI uses codes; accept both.
const knownLang = (value: string | null): LangCode | null => {
  if (!value) return null;
  const v = value.trim().toLowerCase();
  if (v in LANGS) return v as LangCode;
  return (Object.values(LANGS).find((l) => l.name.toLowerCase() === v)?.code as LangCode | undefined) ?? null;
};
const dirOf = (value: string | null) => {
  const code = knownLang(value);
  return code && LANGS[code].rtl ? "rtl" : "auto";
};
const clock = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

// text is what the buyer reads; textEn is the English counterpart. The toggle swaps which one is large.
export default function BuyerBubble({ message: m, view, delivery, assistantName, onReport }: Props) {
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState<ReportReason>("wrong_meaning");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [reportError, setReportError] = useState("");
  const [sent, setSent] = useState(false);

  async function submitReport() {
    if (!onReport) return;
    setBusy(true);
    setReportError("");
    try {
      await onReport(m.id, reason, comment.trim());
      setSent(true);
      setReporting(false);
    } catch (err) {
      setReportError(err instanceof Error ? err.message : "The report could not be sent. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (m.sender === "system") {
    return (
      <p role="status" data-testid={`message-${m.id}`} className="mx-auto max-w-[85%] rounded-full bg-slate-100 px-3.5 py-1.5 text-center text-xs text-slate-600">
        {m.text}
      </p>
    );
  }

  const mine = m.sender === "buyer";
  const hasEnglish = !!m.textEn && m.textEn !== m.text;
  const english = view === "english" && hasEnglish;
  const main = english ? { text: m.textEn as string, lang: "en" } : { text: m.text, lang: m.lang };
  const other = hasEnglish ? (english ? { text: m.text, lang: m.lang } : { text: m.textEn as string, lang: "en" }) : null;

  const bubble = mine ? "bg-indigo-600 text-white" : m.sender === "ai" ? "bg-violet-50 text-slate-900 ring-1 ring-violet-200" : "bg-indigo-50 text-indigo-950";
  const sub = mine ? "text-indigo-100" : "text-slate-500";
  const playable = !mine && knownLang(main.lang) !== null;

  return (
    <div className={`flex flex-col ${mine ? "items-end" : "items-start"}`} data-testid={`message-${m.id}`} data-sender={m.sender}>
      {m.sender === "ai" && (
        <div className="mb-1 px-1">
          <AiBadge label={assistantName} />
        </div>
      )}
      {m.sender === "staff" && (
        <p data-testid={`message-staff-${m.id}`} className="mb-1 px-1 text-[11px] font-semibold text-slate-600">
          {m.staffName ?? "Shop team"} <span className="font-normal text-slate-500">from the shop team</span>
        </p>
      )}
      <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[15px] leading-relaxed sm:max-w-[75%] ${bubble} ${delivery ? "opacity-80" : ""}`}>
        <p lang={knownLang(main.lang) ?? undefined} dir={dirOf(main.lang)} className="whitespace-pre-wrap break-words">
          {m.voiceSeconds ? <Volume2 className="mr-1.5 mb-0.5 inline h-3.5 w-3.5 opacity-80" aria-label="Voice message" /> : null}
          {main.text}
        </p>
        {other && (
          <p lang={knownLang(other.lang) ?? undefined} dir={dirOf(other.lang)} data-testid={`message-secondary-${m.id}`} className={`mt-1.5 border-t pt-1.5 text-[13px] ${mine ? "border-white/25" : "border-indigo-200/70"} ${sub}`}>
            <span className="mr-1.5 inline-flex items-center gap-1 rounded-md bg-black/5 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide">
              <Languages className="h-3 w-3" aria-hidden="true" />
              {mine && other.lang === "en" ? "The shop reads" : (knownLang(other.lang) ?? other.lang ?? "en")}
            </span>
            <span className="break-words">{other.text}</span>
          </p>
        )}
        <div className={`mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] ${sub}`}>
          <span>{delivery === "sending" ? "Sending..." : delivery === "failed" ? "Not sent" : clock(m.createdAt)}</span>
          {m.confidence !== null && (
            <span className="inline-flex items-center gap-1" title="Translation confidence" data-testid={`message-confidence-${m.id}`}>
              <Languages className="h-3 w-3" aria-hidden="true" />
              {Math.round(m.confidence * 100)}%
            </span>
          )}
          {m.numbersVerified && (
            <span data-testid={`numbers-verified-${m.id}`} className={`inline-flex items-center gap-1 ${mine ? "text-emerald-200" : "text-emerald-700"}`}>
              <ShieldCheck className="h-3 w-3" aria-hidden="true" />
              Numbers verified
            </span>
          )}
          {playable && (
            <button
              type="button"
              onClick={() => speak(main.text, knownLang(main.lang) as LangCode)}
              aria-label="Listen to this message"
              data-testid={`play-${m.id}`}
              className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
            >
              <Volume2 className="h-3 w-3" aria-hidden="true" />
              Listen
            </button>
          )}
          {onReport && hasEnglish && !delivery &&
            (m.reported || sent ? (
              <span data-testid={`reported-${m.id}`} className="inline-flex items-center gap-1">
                <Flag className="h-3 w-3" aria-hidden="true" />
                Reported. The shop was told.
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setReporting((o) => !o)}
                aria-expanded={reporting}
                data-testid={`report-btn-${m.id}`}
                className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
              >
                <Flag className="h-3 w-3" aria-hidden="true" />
                Report translation
              </button>
            ))}
        </div>
      </div>
      {reporting && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submitReport();
          }}
          data-testid={`report-form-${m.id}`}
          className="mt-1.5 w-full max-w-[85%] rounded-xl border border-slate-200 bg-white p-3 text-sm shadow-sm sm:max-w-[75%]"
        >
          <p className="font-medium text-slate-900">What is wrong with this translation?</p>
          <label htmlFor={`report-reason-${m.id}`} className="sr-only">
            Reason
          </label>
          <select id={`report-reason-${m.id}`} value={reason} onChange={(e) => setReason(e.target.value as ReportReason)} data-testid={`report-reason-${m.id}`} className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-900">
            {REPORT_REASONS.map((r) => (
              <option key={r} value={r}>
                {REPORT_REASON_LABEL[r]}
              </option>
            ))}
          </select>
          <label htmlFor={`report-comment-${m.id}`} className="sr-only">
            Comment (optional)
          </label>
          <textarea
            id={`report-comment-${m.id}`}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={REPORT_COMMENT_MAX}
            rows={2}
            placeholder="Tell the shop what it should say (optional)"
            data-testid={`report-comment-${m.id}`}
            className="mt-2 w-full resize-none rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-900 placeholder:text-slate-400"
          />
          {reportError && (
            <p role="alert" data-testid={`report-error-${m.id}`} className="mt-2 text-xs text-red-700">
              {reportError}
            </p>
          )}
          <div className="mt-2 flex justify-end gap-2">
            <button type="button" onClick={() => setReporting(false)} disabled={busy} className="rounded-full px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100">
              Cancel
            </button>
            <button type="submit" disabled={busy} data-testid={`report-send-${m.id}`} className="rounded-full bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:bg-slate-300">
              {busy ? "Sending..." : "Send report"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
