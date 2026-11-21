"use client";

import { useState } from "react";
import { Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { BTN_DANGER, BTN_GHOST, BTN_PRIMARY, Card, ErrorBlock, FieldError, FOCUS, INPUT, Label, LoadingBlock, Notice } from "@/components/platform/seller/ui";
import { NextAction } from "@/components/platform/ui";
import LearnPanel from "@/components/platform/seller/LearnPanel";
import { api } from "@/lib/v2/client";
import { errorMessage, useApi } from "@/lib/v2/seller-hooks";
import type { FaqDto } from "@/lib/v2/seller-types";

const Q_MAX = 200;
const A_MAX = 500;
const FAQ_MAX = 50;

function check(q: string, a: string): string {
  if (!q.trim()) return "Enter the question.";
  if (!a.trim()) return "Enter the answer.";
  if (q.trim().length > Q_MAX) return `The question must be at most ${Q_MAX} characters.`;
  if (a.trim().length > A_MAX) return `The answer must be at most ${A_MAX} characters.`;
  return "";
}

export default function KnowledgeManager() {
  const { data, error, loading, reload, update } = useApi<FaqDto[]>("/api/desk/faqs");
  const [q, setQ] = useState("");
  const [a, setA] = useState("");
  const [formError, setFormError] = useState("");
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editQ, setEditQ] = useState("");
  const [editA, setEditA] = useState("");
  const [editError, setEditError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [listError, setListError] = useState("");

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const problem = check(q, a);
    setFormError(problem);
    if (problem) return;
    setAdding(true);
    try {
      const created = await api<FaqDto>("/api/desk/faqs", { method: "POST", json: { q: q.trim(), a: a.trim() } });
      update((list) => [...list, created]);
      setQ("");
      setA("");
      setNotice("The question was added. The AI can use it from the next customer message.");
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setAdding(false);
    }
  };

  const startEdit = (f: FaqDto) => {
    setEditId(f.id);
    setEditQ(f.q);
    setEditA(f.a);
    setEditError("");
  };

  const saveEdit = async (f: FaqDto) => {
    const problem = check(editQ, editA);
    setEditError(problem);
    if (problem) return;
    setBusyId(f.id);
    try {
      const saved = await api<FaqDto>(`/api/desk/faqs/${f.id}`, { method: "PATCH", json: { q: editQ.trim(), a: editA.trim() } });
      update((list) => list.map((x) => (x.id === f.id ? saved : x)));
      setEditId(null);
      setNotice("The question was saved.");
    } catch (err) {
      setEditError(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (f: FaqDto) => {
    setBusyId(f.id);
    setListError("");
    try {
      await api(`/api/desk/faqs/${f.id}`, { method: "DELETE" });
      update((list) => list.filter((x) => x.id !== f.id));
      setConfirmId(null);
      setNotice("The question was deleted.");
    } catch (err) {
      setNotice("");
      setListError(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  const count = data?.length ?? 0;

  return (
    <div className="space-y-6">
      <LearnPanel onSaved={reload} />
      <p data-testid="knowledge-explainer" className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4 text-sm text-slate-700">
        The AI answers customers only from three places: this page, your products and your shop policies in Settings. If a question is not covered, it does not guess: it tells the customer the shop will reply and sends you a notification in the app.
      </p>
      <Notice message={notice} testId="knowledge-confirmation" />

      <Card testId="faq-add-card">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-heading text-lg font-semibold text-slate-900">Add a question</h2>
          <p className="text-xs text-slate-500" data-testid="faq-total">{data ? `${count} of ${FAQ_MAX} used` : ""}</p>
        </div>
        <form onSubmit={add} noValidate className="mt-3 space-y-3">
          <div>
            <Label htmlFor="faq-q">Question</Label>
            <input id="faq-q" value={q} onChange={(e) => setQ(e.target.value)} aria-describedby="faq-q-count faq-form-error" data-testid="faq-question-input" className={INPUT} placeholder="Do you ship to Europe?" />
            <p id="faq-q-count" data-testid="faq-question-count" className={`mt-1 text-right text-xs ${q.length > Q_MAX ? "font-semibold text-red-600" : "text-slate-500"}`}>{q.length} / {Q_MAX}</p>
          </div>
          <div>
            <Label htmlFor="faq-a">Answer</Label>
            <textarea id="faq-a" rows={3} value={a} onChange={(e) => setA(e.target.value)} aria-describedby="faq-a-count faq-form-error" data-testid="faq-answer-input" className={INPUT} placeholder="Yes. Delivery within Europe takes 7 to 10 days." />
            <p id="faq-a-count" data-testid="faq-answer-count" className={`mt-1 text-right text-xs ${a.length > A_MAX ? "font-semibold text-red-600" : "text-slate-500"}`}>{a.length} / {A_MAX}</p>
          </div>
          <FieldError id="faq-form-error" message={formError} testId="faq-form-error" />
          <button type="submit" disabled={adding || !data} data-testid="faq-add" className={BTN_PRIMARY}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            {adding ? "Adding" : "Add question"}
          </button>
        </form>
      </Card>

      {loading && <LoadingBlock label="Loading questions" testId="faq-loading" />}
      {error && !data && <ErrorBlock message={error} onRetry={reload} testId="faq-error" />}
      {listError && <p role="alert" data-testid="faq-list-error" className="text-sm font-medium text-red-600">{listError}</p>}
      {data && data.length === 0 && (
        <p data-testid="faq-empty" className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          No questions yet. Add the questions customers ask most, such as shipping times and returns.
        </p>
      )}
      {data && data.length > 0 && (
        <ul className="space-y-3" data-testid="faq-list">
          {data.map((f) => (
            <li key={f.id} data-testid={`faq-${f.id}`}>
              <Card className="!p-4">
                {editId === f.id ? (
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor={`edit-q-${f.id}`}>Question</Label>
                      <input id={`edit-q-${f.id}`} value={editQ} onChange={(e) => setEditQ(e.target.value)} data-testid={`faq-edit-question-${f.id}`} className={INPUT} />
                      <p className={`mt-1 text-right text-xs ${editQ.length > Q_MAX ? "font-semibold text-red-600" : "text-slate-500"}`} data-testid={`faq-edit-question-count-${f.id}`}>{editQ.length} / {Q_MAX}</p>
                    </div>
                    <div>
                      <Label htmlFor={`edit-a-${f.id}`}>Answer</Label>
                      <textarea id={`edit-a-${f.id}`} rows={3} value={editA} onChange={(e) => setEditA(e.target.value)} data-testid={`faq-edit-answer-${f.id}`} className={INPUT} />
                      <p className={`mt-1 text-right text-xs ${editA.length > A_MAX ? "font-semibold text-red-600" : "text-slate-500"}`} data-testid={`faq-edit-answer-count-${f.id}`}>{editA.length} / {A_MAX}</p>
                    </div>
                    <FieldError id={`edit-error-${f.id}`} message={editError} testId={`faq-edit-error-${f.id}`} />
                    <div className="flex gap-2">
                      <button type="button" onClick={() => saveEdit(f)} disabled={busyId === f.id} data-testid={`faq-save-${f.id}`} className={BTN_PRIMARY}>
                        <Save className="h-4 w-4" aria-hidden="true" />
                        {busyId === f.id ? "Saving" : "Save"}
                      </button>
                      <button type="button" onClick={() => setEditId(null)} data-testid={`faq-edit-cancel-${f.id}`} className={BTN_GHOST}>
                        <X className="h-4 w-4" aria-hidden="true" />
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-slate-900" data-testid={`faq-question-${f.id}`}>{f.q}</p>
                      <p className="mt-1 whitespace-pre-line text-sm text-slate-600" data-testid={`faq-answer-${f.id}`}>{f.a}</p>
                    </div>
                    {confirmId === f.id ? (
                      <div className="flex flex-wrap items-center gap-2" data-testid={`faq-delete-confirm-${f.id}`}>
                        <span className="text-xs text-slate-600">Delete this question?</span>
                        <button type="button" onClick={() => remove(f)} disabled={busyId === f.id} data-testid={`faq-delete-yes-${f.id}`} className={`${BTN_DANGER} !px-3 !py-1.5`}>Yes, delete</button>
                        <button type="button" onClick={() => setConfirmId(null)} data-testid={`faq-delete-no-${f.id}`} className={`${BTN_GHOST} !px-3 !py-1.5`}>Keep it</button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <button type="button" onClick={() => startEdit(f)} aria-label={`Edit question: ${f.q}`} data-testid={`faq-edit-${f.id}`} className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100 ${FOCUS}`}>
                          <Pencil className="h-4 w-4" aria-hidden="true" />
                          Edit
                        </button>
                        <button type="button" onClick={() => setConfirmId(f.id)} aria-label={`Delete question: ${f.q}`} data-testid={`faq-delete-${f.id}`} className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 ${FOCUS}`}>
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}

      <NextAction title="Next: set your policies" text="Returns, payment and shipping details in Settings are also used by the AI." href="/seller/settings" cta="Open settings" />
    </div>
  );
}
