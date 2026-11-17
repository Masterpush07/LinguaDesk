"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import ThemeToggle from "@/components/ThemeToggle";

type Insights = {
  totals: {
    customers: number;
    customer_messages: number;
    ai_replies: number;
    owner_replies: number;
    translated: number;
    waiting_now: number;
    ai_only: number;
  };
  languages: { language: string; n: number }[];
  daily: { label: string; n: number }[];
  topics: Record<string, number>;
};

const TOPIC_LABELS: Record<string, string> = {
  price: "Prices",
  shipping: "Shipping and delivery",
  returns: "Returns and refunds",
  payment: "Payment",
  availability: "Stock, sizes and colours",
  ordering: "Placing an order",
};

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-2xl bg-surface p-4 ring-1 ring-line">
      <p className="text-xs font-medium text-ink-2">{label}</p>
      <p className="mt-1 text-3xl font-bold tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-3">{hint}</p>}
    </div>
  );
}

// Horizontal bars scaled to the largest value in the list.
function Bars({ rows, empty }: { rows: { label: string; n: number }[]; empty: string }) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  if (rows.every((r) => r.n === 0)) return <p className="text-sm text-ink-3">{empty}</p>;
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.label} className="grid grid-cols-[8.5rem_1fr_2rem] items-center gap-3 text-sm">
          <span dir="auto" className="truncate text-ink-2">
            {r.label}
          </span>
          <span className="h-2.5 overflow-hidden rounded-full bg-surface-3">
            <span className="block h-full rounded-full bg-brand" style={{ width: `${(r.n / max) * 100}%` }} />
          </span>
          <span className="text-right tabular-nums text-ink">{r.n}</span>
        </li>
      ))}
    </ul>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-surface p-5 ring-1 ring-line">
      <h2 className="mb-4 text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}

// Owner-only summary of how the assistant is doing: volume, languages, topics and how often a person was needed.
export default function InsightsPage() {
  const [data, setData] = useState<Insights | null>(null);
  const [error, setError] = useState<"auth" | "failed" | null>(null);

  useEffect(() => {
    fetch("/api/owner/insights")
      .then(async (res) => {
        if (res.status === 401) return setError("auth");
        if (!res.ok) return setError("failed");
        setData((await res.json()) as Insights);
      })
      .catch(() => setError("failed"));
  }, []);

  const t = data?.totals;
  const aiShare = t && t.customers > 0 ? Math.round((t.ai_only / t.customers) * 100) : 0;
  const topics = data
    ? Object.entries(data.topics)
        .map(([key, n]) => ({ label: TOPIC_LABELS[key] ?? key, n }))
        .sort((a, b) => b.n - a.n)
    : [];

  return (
    <main className="min-h-dvh bg-surface-2 text-ink">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <Link href="/owner" className="rounded-full px-3 py-1.5 text-sm font-medium text-ink-2 hover:bg-surface-3 hover:text-ink">
            &larr; Inbox
          </Link>
          <h1 className="text-lg font-semibold">Insights</h1>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl space-y-4 px-4 py-6">
        {error === "auth" && (
          <p className="rounded-xl bg-warn-soft px-4 py-3 text-sm text-warn-ink">
            Please <Link href="/owner" className="font-semibold underline">sign in on the owner page</Link> first, then come back.
          </p>
        )}
        {error === "failed" && (
          <p role="alert" className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger-ink">
            Could not load insights. Refresh the page to try again.
          </p>
        )}
        {!data && !error && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-busy="true" aria-label="Loading insights">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl bg-surface-3" />
            ))}
          </div>
        )}

        {data && t && (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="Customers" value={t.customers} hint="Unique chats so far" />
              <Stat label="Questions answered" value={t.customer_messages} hint={`${t.ai_replies} AI replies, ${t.owner_replies} by you`} />
              <Stat label="Handled by AI alone" value={`${aiShare}%`} hint={`${t.ai_only} of ${t.customers} chats never needed you`} />
              <Stat label="Messages translated" value={t.translated} hint="Customer messages not in English" />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Panel title="Customer messages, last 7 days">
                <Bars rows={data.daily} empty="No customer messages in the last 7 days." />
              </Panel>
              <Panel title="Customer languages">
                <Bars rows={data.languages.map((l) => ({ label: l.language, n: l.n }))} empty="No languages detected yet." />
              </Panel>
              <Panel title="What customers ask about">
                <Bars rows={topics} empty="No questions yet." />
              </Panel>
              <Panel title="Right now">
                <p className="text-sm text-ink-2">
                  {t.waiting_now > 0
                    ? `${t.waiting_now} customer${t.waiting_now === 1 ? "" : "s"} waiting for you.`
                    : "Nobody is waiting for you. The AI is handling every open chat."}
                </p>
                <Link href="/owner" className="mt-3 inline-block rounded-full bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover">
                  Open inbox
                </Link>
              </Panel>
            </div>

            <p className="text-xs text-ink-3">
              &quot;Handled by AI alone&quot; counts chats where you never had to write a reply and nobody is waiting. Topics are matched on the
              English translation of each question.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
