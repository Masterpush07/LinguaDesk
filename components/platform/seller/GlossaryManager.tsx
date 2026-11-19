"use client";

import { useState } from "react";
import { FlaskConical, Plus, Trash2 } from "lucide-react";
import { BTN_GHOST, BTN_PRIMARY, Card, ErrorBlock, FieldError, FOCUS, INPUT, Label, LoadingBlock, Notice } from "@/components/platform/seller/ui";
import { api } from "@/lib/v2/client";
import { errorMessage, useApi } from "@/lib/v2/seller-hooks";
import { settingsPayload, type GlossaryDto, type GlossaryTestDto, type SettingsDto, type Tone } from "@/lib/v2/seller-types";

const TONES: { value: Tone; label: string; hint: string }[] = [
  { value: "formal", label: "Formal", hint: "Polite and measured wording." },
  { value: "neutral", label: "Neutral", hint: "Clear and straightforward." },
  { value: "friendly", label: "Friendly", hint: "Warm and conversational." },
];

export default function GlossaryManager() {
  const terms = useApi<GlossaryDto[]>("/api/desk/glossary");
  const settings = useApi<SettingsDto>("/api/desk/settings");
  const [term, setTerm] = useState("");
  const [rule, setRule] = useState<GlossaryDto["rule"]>("keep");
  const [note, setNote] = useState("");
  const [termError, setTermError] = useState("");
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [listError, setListError] = useState("");
  const [toneSaving, setToneSaving] = useState(false);
  const [toneNotice, setToneNotice] = useState("");
  const [toneError, setToneError] = useState("");
  const [message, setMessage] = useState("");
  const [testing, setTesting] = useState(false);
  const [testError, setTestError] = useState("");
  const [result, setResult] = useState<GlossaryTestDto | null>(null);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const t = term.trim();
    if (!t) return setTermError("Enter the term first.");
    if (t.length > 60) return setTermError("The term must be at most 60 characters.");
    if (rule === "fixed" && !note.trim()) return setTermError("Enter the wording the AI must always use for this term.");
    if (note.trim().length > 200) return setTermError("The note must be at most 200 characters.");
    setTermError("");
    setAdding(true);
    try {
      const created = await api<GlossaryDto>("/api/desk/glossary", { method: "POST", json: { term: t, rule, note: note.trim() } });
      terms.update((list) => [...list, created].sort((a, b) => a.term.toLowerCase().localeCompare(b.term.toLowerCase())));
      setTerm("");
      setNote("");
      setListError("");
      setNotice(`"${created.term}" was added to the glossary.`);
    } catch (err) {
      setTermError(errorMessage(err));
    } finally {
      setAdding(false);
    }
  };

  const remove = async (g: GlossaryDto) => {
    setRemovingId(g.id);
    setListError("");
    try {
      await api(`/api/desk/glossary/${g.id}`, { method: "DELETE" });
      terms.update((list) => list.filter((x) => x.id !== g.id));
      setNotice(`"${g.term}" was removed from the glossary.`);
    } catch (err) {
      setNotice("");
      setListError(`${g.term}: ${errorMessage(err)}`);
    } finally {
      setRemovingId(null);
    }
  };

  const changeTone = async (tone: Tone) => {
    if (!settings.data || toneSaving || tone === settings.data.tone) return;
    setToneSaving(true);
    setToneError("");
    try {
      const saved = await api<SettingsDto>("/api/desk/settings", { method: "PUT", json: { ...settingsPayload(settings.data), tone } });
      settings.update(() => saved);
      setToneNotice(`The AI tone is now ${saved.tone}.`);
    } catch (err) {
      setToneNotice("");
      setToneError(errorMessage(err));
    } finally {
      setToneSaving(false);
    }
  };

  const runTest = async (e: React.FormEvent) => {
    e.preventDefault();
    const m = message.trim();
    if (!m) return setTestError("Type a message a customer might send.");
    if (m.length > 500) return setTestError("The test message must be at most 500 characters.");
    setTesting(true);
    setTestError("");
    setResult(null);
    try {
      setResult(await api<GlossaryTestDto>("/api/desk/glossary/test", { method: "POST", json: { message: m } }));
    } catch (err) {
      setTestError(errorMessage(err));
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Notice message={notice} testId="glossary-confirmation" />

      <Card testId="tone-card">
        <h2 className="font-heading text-lg font-semibold text-slate-900">AI tone</h2>
        <p className="mt-0.5 text-sm text-slate-500">The voice the AI assistant uses when it writes to customers. The change is saved as soon as you select it.</p>
        {settings.loading && <div className="mt-3"><LoadingBlock label="Loading tone" testId="tone-loading" rows={1} /></div>}
        {settings.error && !settings.data && <div className="mt-3"><ErrorBlock message={settings.error} onRetry={settings.reload} testId="tone-error" /></div>}
        {settings.data && (
          <fieldset className="mt-3" disabled={toneSaving}>
            <legend className="sr-only">AI tone</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {TONES.map((t) => {
                const on = settings.data!.tone === t.value;
                return (
                  <label key={t.value} className={`flex cursor-pointer items-start gap-2 rounded-xl border p-3 text-sm focus-within:ring-2 focus-within:ring-indigo-500 ${on ? "border-indigo-400 bg-indigo-50" : "border-slate-200 hover:bg-slate-50"}`}>
                    <input type="radio" name="tone" value={t.value} checked={on} onChange={() => changeTone(t.value)} data-testid={`tone-${t.value}`} className="mt-1" />
                    <span>
                      <span className="block font-medium text-slate-900">{t.label}</span>
                      <span className="block text-xs text-slate-500">{t.hint}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        )}
        <Notice message={toneNotice} testId="tone-confirmation" />
        <p role="alert" data-testid="tone-save-error" className="min-h-4 text-sm font-medium text-red-600">{toneError}</p>
      </Card>

      <Card testId="glossary-card">
        <h2 className="font-heading text-lg font-semibold text-slate-900">Glossary terms</h2>
        <p className="mt-0.5 text-sm text-slate-500">Brand names and product words the AI must handle your way in every language.</p>

        <form onSubmit={add} noValidate className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_1fr_auto] sm:items-start">
          <div>
            <Label htmlFor="gl-term">Term</Label>
            <input id="gl-term" value={term} maxLength={60} onChange={(e) => setTerm(e.target.value)} aria-describedby="gl-error" aria-invalid={!!termError} data-testid="glossary-term-input" className={INPUT} placeholder="Ajrakh" />
          </div>
          <div>
            <Label htmlFor="gl-rule">Rule</Label>
            <select id="gl-rule" value={rule} onChange={(e) => setRule(e.target.value as GlossaryDto["rule"])} data-testid="glossary-rule-select" className={INPUT}>
              <option value="keep">Never translate</option>
              <option value="fixed">Always translate as</option>
            </select>
          </div>
          <div>
            <Label htmlFor="gl-note">{rule === "fixed" ? "Wording to use" : "Note (optional)"}</Label>
            <input id="gl-note" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} data-testid="glossary-note-input" className={INPUT} placeholder={rule === "fixed" ? "block-printed cotton" : "Traditional printing technique"} />
          </div>
          <button type="submit" disabled={adding} data-testid="glossary-add" className={`${BTN_PRIMARY} sm:mt-7`}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            {adding ? "Adding" : "Add term"}
          </button>
          <div className="sm:col-span-4">
            <FieldError id="gl-error" message={termError} testId="glossary-error" />
          </div>
        </form>

        <div className="mt-2">
          {terms.loading && <LoadingBlock label="Loading glossary" testId="glossary-loading" rows={2} />}
          {terms.error && !terms.data && <ErrorBlock message={terms.error} onRetry={terms.reload} testId="glossary-load-error" />}
          {listError && <p role="alert" data-testid="glossary-list-error" className="mb-2 text-sm font-medium text-red-600">{listError}</p>}
          {terms.data && terms.data.length === 0 && (
            <p data-testid="glossary-empty" className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
              No terms yet. Without a glossary the AI translates every word, including brand and craft names.
            </p>
          )}
          {terms.data && terms.data.length > 0 && (
            <ul className="divide-y divide-slate-100" data-testid="glossary-list">
              {terms.data.map((g) => (
                <li key={g.id} data-testid={`glossary-term-${g.id}`} className="flex flex-wrap items-center gap-3 py-3">
                  <span className="font-medium text-slate-900">{g.term}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${g.rule === "keep" ? "bg-violet-50 text-violet-700 ring-violet-200" : "bg-cyan-50 text-cyan-700 ring-cyan-200"}`}>
                    {g.rule === "keep" ? "Never translate" : "Always translate as"}
                  </span>
                  {g.note && <span className="min-w-0 flex-1 truncate text-sm text-slate-500">{g.note}</span>}
                  <button type="button" onClick={() => remove(g)} disabled={removingId === g.id} aria-label={`Remove ${g.term}`} data-testid={`glossary-remove-${g.id}`} className={`ml-auto inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50 ${FOCUS}`}>
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      <Card testId="glossary-test-card">
        <h2 className="font-heading text-lg font-semibold text-slate-900">Test as a buyer</h2>
        <p className="mt-0.5 text-sm text-slate-500">Write a message in any language to see how the AI would reply, using your current products, policies, knowledge base and glossary. Tests are not sent to customers.</p>
        <form onSubmit={runTest} noValidate className="mt-3">
          <Label htmlFor="gl-test">Customer message</Label>
          <textarea id="gl-test" rows={3} value={message} maxLength={500} onChange={(e) => setMessage(e.target.value)} aria-describedby="gl-test-error gl-test-count" aria-invalid={!!testError} data-testid="glossary-test-input" className={INPUT} placeholder="¿Cuánto cuesta el envío a España?" />
          <div className="flex items-start justify-between gap-3">
            <p id="gl-test-error" role="alert" data-testid="glossary-test-error" className="mt-1 min-h-4 text-xs font-medium text-red-600">{testError}</p>
            <p id="gl-test-count" data-testid="glossary-test-count" className="mt-1 shrink-0 text-xs text-slate-500">{message.length} / 500</p>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="submit" disabled={testing} data-testid="glossary-test-run" className={BTN_PRIMARY}>
              <FlaskConical className="h-4 w-4" aria-hidden="true" />
              {testing ? "Testing" : "Run test"}
            </button>
            {(result || message) && (
              <button type="button" onClick={() => { setMessage(""); setResult(null); setTestError(""); }} data-testid="glossary-test-clear" className={BTN_GHOST}>
                Clear test
              </button>
            )}
          </div>
        </form>
        <div aria-live="polite" data-testid="glossary-test-result-region">
          {result && (
            <div data-testid="glossary-test-result" className="mt-4 rounded-xl border border-violet-200 bg-violet-50/60 p-4">
              <p className="inline-flex rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-violet-700" data-testid="glossary-test-label">{result.label}</p>
              <p className="mt-2 text-sm text-slate-900" data-testid="glossary-test-reply">{result.reply}</p>
              <dl className="mt-3 grid gap-1 text-xs text-slate-600 sm:grid-cols-2">
                <div>
                  <dt className="inline font-medium">Detected language: </dt>
                  <dd className="inline" data-testid="glossary-test-language">{result.language}</dd>
                </div>
                <div>
                  <dt className="inline font-medium">Message in English: </dt>
                  <dd className="inline" data-testid="glossary-test-english">{result.buyerMessageEnglish}</dd>
                </div>
              </dl>
              {result.needsAgent && (
                <p data-testid="glossary-test-handoff" className="mt-2 text-xs font-medium text-amber-700">
                  {result.blocked ? "The AI draft was blocked because it contained a number that is not in your shop information. A customer would be handed to an agent." : "For this message the AI would hand the conversation to an agent."}
                </p>
              )}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
