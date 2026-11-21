"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BookOpenCheck, Save, X } from "lucide-react";
import { BTN_GHOST, BTN_PRIMARY, Card, ErrorBlock, FieldError, INPUT, Label, LoadingBlock, Notice } from "@/components/platform/seller/ui";
import { api } from "@/lib/v2/client";
import type { LearnItem, LearnResponse } from "@/lib/v2/learn-types";
import { errorMessage, useApi } from "@/lib/v2/seller-hooks";
import { formatDateTime } from "@/lib/v2/seller-types";

const Q_MAX = 200;
const A_MAX = 500;

type CardProps = {
  item: LearnItem;
  highlighted: boolean;
  onDone: (threadId: string, saved: boolean) => void;
};

function LearnCard({ item, highlighted, onDone }: CardProps) {
  const [question, setQuestion] = useState(item.question);
  const [answer, setAnswer] = useState(item.suggestedAnswer);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<"" | "save" | "dismiss">("");
  const id = item.threadId;

  const submit = async (action: "save" | "dismiss") => {
    if (action === "save") {
      if (!question.trim()) return setError("Enter the customer question.");
      if (!answer.trim()) return setError("Enter the answer the assistant should give.");
      if (question.trim().length > Q_MAX) return setError(`The question must be at most ${Q_MAX} characters.`);
      if (answer.trim().length > A_MAX) return setError(`The answer must be at most ${A_MAX} characters.`);
    }
    setError("");
    setBusy(action);
    try {
      await api("/api/desk/learn", { method: "POST", json: { threadId: id, action, question: question.trim(), answer: answer.trim() } });
      onDone(id, action === "save");
    } catch (err) {
      setError(errorMessage(err));
      setBusy("");
    }
  };

  return (
    <li id={`learn-${id}`} data-testid={`learn-item-${id}`} className={`rounded-2xl border bg-white p-4 ${highlighted ? "border-indigo-400 ring-2 ring-indigo-200" : "border-slate-200"}`}>
      <p className="text-xs text-slate-500" data-testid={`learn-asked-${id}`}>
        Asked {formatDateTime(item.askedAt)}
        {item.answered && ". You already replied to this customer"}
      </p>
      <div className="mt-3 space-y-3">
        <div>
          <Label htmlFor={`learn-q-${id}`}>Customer question</Label>
          <textarea id={`learn-q-${id}`} rows={2} value={question} onChange={(e) => setQuestion(e.target.value)} disabled={busy !== ""} aria-describedby={`learn-q-count-${id} learn-error-${id}`} data-testid={`learn-question-${id}`} className={INPUT} />
          <p id={`learn-q-count-${id}`} className={`mt-1 text-right text-xs ${question.length > Q_MAX ? "font-semibold text-red-600" : "text-slate-500"}`}>{question.length} / {Q_MAX}</p>
        </div>
        <div>
          <Label htmlFor={`learn-a-${id}`} hint={item.answered ? "Prefilled from your reply. Edit it so it works for any customer." : "Write the answer the assistant should give."}>Answer</Label>
          <textarea id={`learn-a-${id}`} rows={3} value={answer} onChange={(e) => setAnswer(e.target.value)} disabled={busy !== ""} aria-describedby={`learn-a-count-${id} learn-error-${id}`} data-testid={`learn-answer-${id}`} className={INPUT} />
          <p id={`learn-a-count-${id}`} className={`mt-1 text-right text-xs ${answer.length > A_MAX ? "font-semibold text-red-600" : "text-slate-500"}`}>{answer.length} / {A_MAX}</p>
        </div>
        <div aria-live="polite">
          <FieldError id={`learn-error-${id}`} message={error} testId={`learn-error-${id}`} />
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void submit("save")} disabled={busy !== ""} data-testid={`learn-save-${id}`} className={BTN_PRIMARY}>
            <Save className="h-4 w-4" aria-hidden="true" />
            {busy === "save" ? "Saving" : "Save to knowledge base"}
          </button>
          <button type="button" onClick={() => void submit("dismiss")} disabled={busy !== ""} data-testid={`learn-dismiss-${id}`} className={BTN_GHOST}>
            <X className="h-4 w-4" aria-hidden="true" />
            {busy === "dismiss" ? "Dismissing" : "Dismiss"}
          </button>
        </div>
      </div>
    </li>
  );
}

export default function LearnPanel({ onSaved }: { onSaved?: () => void }) {
  const focusId = useSearchParams().get("thread");
  const { data, error, loading, reload, update } = useApi<LearnResponse>("/api/desk/learn");
  const [notice, setNotice] = useState("");
  const scrolled = useRef<string | null>(null);

  const itemCount = data?.items.length ?? 0;
  useEffect(() => {
    if (!focusId || itemCount === 0 || scrolled.current === focusId) return;
    const el = document.getElementById(`learn-${focusId}`);
    if (!el) return;
    scrolled.current = focusId;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
  }, [focusId, itemCount]);

  const done = (threadId: string, saved: boolean) => {
    update((prev) => ({ items: prev.items.filter((i) => i.threadId !== threadId), total: Math.max(0, prev.total - 1) }));
    setNotice(saved ? "Saved to the knowledge base. The assistant can use it from the next customer message." : "The question was dismissed.");
    if (saved) onSaved?.();
  };

  return (
    <Card testId="learn-panel">
      <div className="flex items-center gap-2">
        <BookOpenCheck className="h-5 w-5 text-indigo-600" aria-hidden="true" />
        <h2 className="font-heading text-lg font-semibold text-slate-900">Teach your assistant</h2>
      </div>
      <p className="mt-1 text-sm text-slate-600" data-testid="learn-explainer">
        These are real customer questions the assistant could not answer. When you save an answer, the assistant can answer the same question on its own next time.
      </p>
      <Notice message={notice} testId="learn-confirmation" />
      <div className="mt-3">
        {loading && <LoadingBlock label="Loading unanswered questions" testId="learn-loading" rows={2} />}
        {error && !data && <ErrorBlock message={error} onRetry={reload} testId="learn-error" />}
        {data && data.items.length === 0 && (
          <p data-testid="learn-empty" className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
            No unanswered questions. When the assistant cannot answer, the question appears here.
          </p>
        )}
        {data && data.items.length > 0 && (
          <ul className="space-y-3" data-testid="learn-list">
            {data.items.map((item) => (
              <LearnCard key={item.threadId} item={item} highlighted={item.threadId === focusId} onDone={done} />
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
