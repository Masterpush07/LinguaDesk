"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, CheckCircle2, ChevronLeft, ChevronRight, Pause, Play, RotateCcw, ShieldCheck, Star } from "lucide-react";
import DualBubble from "@/components/platform/DualBubble";
import SlaChip from "@/components/platform/SlaChip";
import { Avatar, LangBadge, StatusBadge } from "@/components/platform/ui";
import { formatPrice, getAgent, LANGS } from "@/lib/platform/data";
import type { ConvStatus, LangCode, Msg } from "@/lib/platform/types";

type DemoLang = "es" | "ja" | "hi" | "ar";
type Line = "q1" | "a1" | "q2" | "handover" | "reply" | "confirm";

const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2";
const LAST = 7;

const EN: Record<Line, string> = {
  q1: "How much is the silk spool set?",
  a1: "The silk and cotton spool set costs $35. It has six colours.",
  q2: "Can you make a custom set in my wedding colours by next week?",
  handover: "That is outside my shop information, so I am bringing in a team member.",
  reply: "Yes, we can. A custom set takes 6 business days and costs $48. Which colours would you like?",
  confirm: "Perfect, I'll take it.",
};

const BACK_TRANSLATION = "Yes, we can do that. A custom set takes 6 working days and costs $48. Which colours do you prefer?";

const SCRIPT: Record<DemoLang, { customer: string; agentId: string; lines: Record<Line, string> }> = {
  es: {
    customer: "Sofía Martínez",
    agentId: "priya",
    lines: {
      q1: "¿Cuánto cuesta el set de carretes de seda?",
      a1: "El set de carretes de seda y algodón cuesta $35. Incluye seis colores.",
      q2: "¿Pueden hacer un set personalizado con los colores de mi boda para la próxima semana?",
      handover: "Eso está fuera de la información de la tienda, así que voy a llamar a una persona del equipo.",
      reply: "Sí, podemos. Un set personalizado tarda 6 días hábiles y cuesta $48. ¿Qué colores le gustarían?",
      confirm: "Perfecto, lo quiero.",
    },
  },
  ja: {
    customer: "Haruto Sato",
    agentId: "kenji",
    lines: {
      q1: "シルクの糸巻きセットはいくらですか？",
      a1: "絹と綿のスプールセットは35ドルです。6色入りです。",
      q2: "結婚式のカラーで特注セットを来週までに作ってもらえますか？",
      handover: "それは店舗情報の範囲外ですので、スタッフをお呼びします。",
      reply: "はい、可能です。特注セットは6営業日、48ドルです。ご希望の色を教えてください。",
      confirm: "ぜひお願いします。",
    },
  },
  hi: {
    customer: "Ananya Rao",
    agentId: "priya",
    lines: {
      q1: "रेशमी स्पूल सेट की कीमत कितनी है?",
      a1: "रेशम और सूती स्पूल सेट की कीमत $35 है। इसमें छह रंग हैं।",
      q2: "क्या आप अगले हफ़्ते तक मेरी शादी के रंगों में एक कस्टम सेट बना सकते हैं?",
      handover: "यह दुकान की जानकारी से बाहर है, इसलिए टीम के एक सदस्य को बुलाया जा रहा है।",
      reply: "जी हाँ, हम बना सकते हैं। कस्टम सेट में 6 कार्य दिवस लगते हैं और इसकी कीमत $48 है। आप कौन से रंग चाहेंगे?",
      confirm: "ठीक है, यह मुझे चाहिए।",
    },
  },
  ar: {
    customer: "Layla Hassan",
    agentId: "amina",
    lines: {
      q1: "كم سعر طقم بكرات الحرير؟",
      a1: "تبلغ تكلفة طقم بكرات الحرير والقطن 35 دولارًا. يحتوي على ستة ألوان.",
      q2: "هل يمكنكم تصنيع طقم مخصص بألوان حفل زفافي بحلول الأسبوع القادم؟",
      handover: "هذا خارج معلومات المتجر، لذلك سأستدعي أحد أعضاء الفريق.",
      reply: "نعم، يمكننا ذلك. يستغرق الطقم المخصص 6 أيام عمل ويكلف 48 دولارًا. ما الألوان التي تفضلونها؟",
      confirm: "ممتاز، سآخذه.",
    },
  },
};

const DEMO_LANGS: DemoLang[] = ["es", "ja", "hi", "ar"];

const STEPS = [
  { title: "Customer asks", caption: "A customer writes in their own language. The agent side reads the English translation automatically." },
  { title: "AI answers", caption: "The AI answers from the shop's own product information. The price is checked by code, so $35 can never turn into $53." },
  { title: "Out of scope", caption: "The customer asks for something the shop information does not cover." },
  { title: "AI hands over", caption: "The AI does not guess. It hands over, and the chat moves from “AI answering” to “Waiting for agent”." },
  { title: "Dispatch assigns", caption: "Dispatch picks an agent who speaks the customer's language and starts the reply-time countdown." },
  { title: "Checked reply", caption: "The agent writes in English. Before sending, the text is translated back to English to check its meaning, and every number is verified." },
  { title: "Order confirmed", caption: "The agent sends an order card. The customer confirms and the order is placed." },
  { title: "Customer rates", caption: "After the chat, the customer rates the service. The conversation is resolved." },
];

const TIMES = ["10:42", "10:42", "10:44", "10:44", "10:45", "10:47", "10:48", "10:50"];

type Item =
  | { at: number; kind: "msg"; msg: Msg }
  | { at: number; kind: "join" }
  | { at: number; kind: "backcheck" }
  | { at: number; kind: "order" }
  | { at: number; kind: "rating" };

function statusAt(step: number): ConvStatus {
  if (step <= 2) return "ai";
  if (step === 3) return "waiting";
  if (step <= 6) return "assigned";
  return "resolved";
}

function buildItems(lang: DemoLang): Item[] {
  const s = SCRIPT[lang];
  const fromCustomer = (id: string, line: Line, at: number): Item => ({
    at,
    kind: "msg",
    msg: { id, from: "customer", original_text: s.lines[line], original_lang: lang, translated_text: EN[line], target_lang: "en", is_ai_generated: false, confidence_score: 0.97, time: TIMES[at] },
  });
  const toCustomer = (id: string, from: "ai" | "agent", line: Line, at: number): Item => ({
    at,
    kind: "msg",
    msg: { id, from, original_text: EN[line], original_lang: "en", translated_text: s.lines[line], target_lang: lang, is_ai_generated: from === "ai", confidence_score: 0.98, time: TIMES[at], numbersVerified: line === "a1" || line === "reply" },
  });
  return [
    fromCustomer("d-1", "q1", 0),
    toCustomer("d-2", "ai", "a1", 1),
    fromCustomer("d-3", "q2", 2),
    toCustomer("d-4", "ai", "handover", 3),
    { at: 4, kind: "join" },
    toCustomer("d-5", "agent", "reply", 5),
    { at: 5, kind: "backcheck" },
    fromCustomer("d-6", "confirm", 6),
    { at: 6, kind: "order" },
    { at: 7, kind: "rating" },
  ];
}

function Stars({ value, dark }: { value: number; dark?: boolean }) {
  return (
    <span className="inline-flex gap-0.5" role="img" aria-label={`${value} out of 5 stars`} data-testid={dark ? "demo-rating-desk" : "demo-rating-customer"}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={`h-5 w-5 ${n <= value ? "fill-amber-400 text-amber-400" : dark ? "text-slate-600" : "text-slate-300"}`} aria-hidden="true" />
      ))}
    </span>
  );
}

export default function LiveDemo() {
  const [step, setStep] = useState(0);
  const [lang, setLang] = useState<DemoLang>("es");
  const [playing, setPlaying] = useState(false);
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);

  const running = playing && step < LAST;

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setStep((s) => Math.min(s + 1, LAST)), 3000);
    return () => clearInterval(id);
  }, [running]);

  useEffect(() => {
    for (const el of [leftRef.current, rightRef.current]) el?.scrollTo({ top: el.scrollHeight });
  }, [step, lang]);

  const items = useMemo(() => buildItems(lang), [lang]);
  const visible = items.filter((i) => i.at <= step);
  const script = SCRIPT[lang];
  const agent = getAgent(script.agentId);
  const status = statusAt(step);
  const handingOver = step === 3;
  const manual = (n: number) => {
    setPlaying(false);
    setStep(Math.max(0, Math.min(LAST, n)));
  };

  const orderLine = `Custom silk & cotton spool set × 1 · ${formatPrice(48)}`;

  return (
    <div data-testid="live-demo">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div role="radiogroup" aria-label="Customer language" className="flex flex-wrap items-center gap-2" data-testid="demo-language-switcher">
          <span className="text-sm font-medium text-slate-600">Customer speaks:</span>
          {DEMO_LANGS.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={lang === c}
              onClick={() => setLang(c)}
              data-testid={`demo-lang-${c}`}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium ${FOCUS} ${lang === c ? "bg-indigo-600 text-white" : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"}`}
            >
              <span aria-hidden="true">{LANGS[c].flag}</span> {LANGS[c].name}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Demo controls">
          <button type="button" onClick={() => manual(step - 1)} disabled={step === 0} data-testid="demo-prev" className={`inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 ${FOCUS}`}>
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />Previous
          </button>
          <button type="button" onClick={() => manual(step + 1)} disabled={step === LAST} data-testid="demo-next" className={`inline-flex items-center gap-1 rounded-full bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-40 ${FOCUS}`}>
            Next step<ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => {
              if (running) return setPlaying(false);
              if (step >= LAST) setStep(0);
              setPlaying(true);
            }}
            aria-pressed={running}
            data-testid="demo-play"
            className={`inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 ${FOCUS}`}
          >
            {running ? <Pause className="h-4 w-4" aria-hidden="true" /> : <Play className="h-4 w-4" aria-hidden="true" />}
            {running ? "Pause" : "Auto-play"}
          </button>
          <button type="button" onClick={() => { setPlaying(false); setStep(0); }} data-testid="demo-restart" className={`inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 ${FOCUS}`}>
            <RotateCcw className="h-4 w-4" aria-hidden="true" />Restart
          </button>
        </div>
      </div>

      <ol className="mb-3 flex gap-1.5 overflow-x-auto pb-1" aria-label="Scenario steps" data-testid="demo-stepper">
        {STEPS.map((s, i) => (
          <li key={s.title} className="min-w-0 flex-1">
            <button
              type="button"
              onClick={() => manual(i)}
              aria-current={i === step ? "step" : undefined}
              data-testid={`demo-step-${i + 1}`}
              data-state={i < step ? "done" : i === step ? "current" : "todo"}
              className={`w-full rounded-lg px-2 py-1.5 text-left text-[11px] font-medium leading-tight ${FOCUS} ${i === step ? "bg-indigo-600 text-white" : i < step ? "bg-indigo-100 text-indigo-800" : "bg-slate-100 text-slate-500"}`}
            >
              <span className="block font-mono text-[10px] opacity-80">{i + 1}</span>
              <span className="hidden sm:block">{s.title}</span>
            </button>
          </li>
        ))}
      </ol>

      <div role="status" aria-live="polite" data-testid="demo-caption" className="mb-4 rounded-2xl border border-indigo-100 bg-indigo-50/70 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">What you are seeing · step {step + 1} of {STEPS.length}</p>
        <p className="mt-1 font-heading text-base font-semibold text-slate-900">{STEPS[step].title}</p>
        <p className="text-sm text-slate-600">{STEPS[step].caption}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section aria-label="Customer phone" data-testid="demo-customer-panel" className="flex h-[560px] flex-col overflow-hidden rounded-[2rem] border-4 border-slate-300 bg-white shadow-lg lg:h-[640px]">
          <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3">
            <Avatar name="Kyoto Dye Studio" size="h-9 w-9" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-heading text-sm font-semibold text-slate-900">Kyoto Dye Studio</p>
              <p data-testid="demo-customer-status" className="text-xs text-slate-500">
                {status === "ai" && "AI assistant is answering"}
                {status === "waiting" && "Finding a team member for you…"}
                {status === "assigned" && `${agent?.name ?? "A team member"} is with you`}
                {status === "resolved" && "Chat finished"}
              </p>
            </div>
            <LangBadge code={lang} />
          </header>
          <div ref={leftRef} className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-4" data-testid="demo-customer-messages">
            {visible.map((it) => {
              if (it.kind === "msg") {
                const mine = it.msg.from === "customer";
                return <DualBubble key={it.msg.id} msg={it.msg} mine={mine} primary={mine ? "original" : "translated"} />;
              }
              if (it.kind === "join") return <p key="join" data-testid="demo-customer-join" className="text-center text-xs text-slate-500">{agent?.name} joined the chat</p>;
              if (it.kind === "order") {
                return (
                  <div key="order" data-testid="demo-customer-order" className="mx-auto max-w-[85%] rounded-2xl border border-emerald-200 bg-white p-3 text-sm">
                    <p className="flex items-center gap-1.5 font-semibold text-emerald-700"><CheckCircle2 className="h-4 w-4" aria-hidden="true" />Order confirmed</p>
                    <p className="mt-1 text-slate-800">{orderLine}</p>
                    <p className="text-xs text-slate-500">Order ORD-2099 · ready in 6 business days</p>
                  </div>
                );
              }
              if (it.kind === "rating") {
                return (
                  <div key="rating" data-testid="demo-customer-rating" className="mx-auto max-w-[85%] rounded-2xl border border-slate-200 bg-white p-3 text-center">
                    <p className="text-sm font-medium text-slate-800">How was your chat?</p>
                    <div className="mt-1"><Stars value={5} /></div>
                    <p className="mt-1 text-xs text-slate-500">Thank you for your feedback.</p>
                  </div>
                );
              }
              return null;
            })}
          </div>
          <div className="border-t border-slate-200 bg-white p-3">
            <label htmlFor="demo-composer" className="sr-only">Customer message (demo only)</label>
            <input id="demo-composer" disabled placeholder="Demo: messages are scripted" data-testid="demo-customer-composer" className="w-full rounded-full border border-slate-200 bg-slate-100 px-4 py-2 text-sm text-slate-500" />
          </div>
        </section>

        <section aria-label="Agent desk" data-testid="demo-agent-panel" className="flex h-[560px] flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 text-slate-100 shadow-lg lg:h-[640px]">
          <header className="flex flex-wrap items-center gap-2 border-b border-slate-800 bg-slate-900 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate font-heading text-sm font-semibold text-white">
                <span aria-hidden="true">{LANGS[lang].flag}</span> {script.customer}
              </p>
              <p className="text-xs text-slate-400">Agent desk · Kyoto Dye Studio</p>
            </div>
            <div className="flex items-center gap-1.5" data-testid="demo-desk-status">
              {handingOver && (
                <>
                  <StatusBadge status="ai" dark />
                  <ArrowRight className="h-3.5 w-3.5 text-slate-500" aria-label="changes to" />
                </>
              )}
              <StatusBadge status={status} dark />
            </div>
          </header>
          <div ref={rightRef} className="flex-1 space-y-3 overflow-y-auto p-4" data-testid="demo-agent-messages">
            {visible.map((it) => {
              if (it.kind === "msg") {
                const mine = it.msg.from !== "customer";
                return <DualBubble key={it.msg.id} msg={it.msg} mine={mine} primary={mine ? "original" : "translated"} dark />;
              }
              if (it.kind === "join" && agent) {
                return (
                  <div key="join" data-testid="demo-agent-card" className="rounded-xl border border-slate-700 bg-slate-900 p-3">
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-cyan-300">Dispatch assigned an agent</p>
                    <div className="flex items-center gap-3">
                      <Avatar name={agent.name} src={agent.avatar} size="h-11 w-11" dark />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-white">{agent.name}</p>
                        <p className="text-xs text-slate-400">{agent.role}</p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {agent.languages.map((c: LangCode) => <LangBadge key={c} code={c} dark />)}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="mb-1 text-[10px] text-slate-400">Reply within</p>
                        <SlaChip key={lang} seconds={900} />
                      </div>
                    </div>
                  </div>
                );
              }
              if (it.kind === "backcheck") {
                return (
                  <div key="backcheck" data-testid="demo-backcheck" className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-3 text-sm">
                    <p className="flex items-center gap-1.5 font-semibold text-emerald-300"><ShieldCheck className="h-4 w-4" aria-hidden="true" />Back-translation check passed</p>
                    <p lang="en" className="mt-1 text-slate-300">Translated back to English: “{BACK_TRANSLATION}”</p>
                    <p className="mt-1 text-xs text-emerald-200">Numbers matched: 6 business days, {formatPrice(48)}.</p>
                  </div>
                );
              }
              if (it.kind === "order") {
                return (
                  <div key="order" data-testid="demo-agent-order" className="ml-auto max-w-[85%] rounded-xl border border-indigo-400/30 bg-indigo-500/10 p-3 text-sm">
                    <p className="flex items-center gap-1.5 font-semibold text-indigo-200"><CheckCircle2 className="h-4 w-4" aria-hidden="true" />Order card sent · confirmed by customer</p>
                    <p className="mt-1 text-slate-200">{orderLine}</p>
                  </div>
                );
              }
              if (it.kind === "rating") {
                return (
                  <div key="rating" data-testid="demo-agent-rating" className="rounded-xl border border-slate-700 bg-slate-900 p-3 text-center">
                    <p className="text-sm font-medium text-slate-200">Customer rating</p>
                    <div className="mt-1"><Stars value={5} dark /></div>
                    <p className="mt-1 text-xs text-slate-400">Chat resolved</p>
                  </div>
                );
              }
              return null;
            })}
          </div>
        </section>
      </div>
      <p className="mt-3 text-center text-xs text-slate-500">All messages are scripted sample data. No real AI or people are involved in this demo.</p>
    </div>
  );
}
