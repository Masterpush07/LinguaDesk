"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { browserTimeZone, useApi } from "@/lib/v2/seller-hooks";
import { formatMinutes, formatUsd, type AnalyticsDto } from "@/lib/v2/seller-types";

// One analytics screen used in two themes: light inside the seller studio, dark inside the agent desk.
const THEMES = {
  light: {
    card: "rounded-2xl border border-slate-200 bg-white p-5",
    heading: "font-heading text-lg font-semibold text-slate-900",
    sub: "text-sm text-slate-500",
    label: "text-xs font-medium text-slate-500",
    value: "font-heading text-3xl font-semibold text-slate-900",
    muted: "text-slate-500",
    body: "text-slate-800",
    track: "#e2e8f0",
    grid: "#e2e8f0",
    axis: "#64748b",
    bar: "#818cf8",
    line: "#0891b2",
    barAlt: "#4f46e5",
    border: "border-slate-200",
    divide: "divide-slate-100",
    head: "text-slate-500",
    emptyBox: "border-dashed border-slate-300 text-slate-500",
    toggleOn: "bg-indigo-600 text-white ring-indigo-600",
    toggleOff: "bg-white text-slate-600 ring-slate-300 hover:bg-slate-50",
    error: "border-red-200 bg-red-50 text-red-800",
    skeleton: "bg-slate-200/70",
  },
  dark: {
    card: "rounded-2xl border border-slate-800 bg-[#111827] p-4",
    heading: "font-heading text-sm font-semibold tracking-tight text-slate-100",
    sub: "text-xs text-slate-400",
    label: "font-mono text-[11px] font-semibold uppercase tracking-wide text-slate-400",
    value: "font-heading text-2xl font-semibold tracking-tight text-slate-100",
    muted: "text-slate-400",
    body: "text-slate-200",
    track: "#1E293B",
    grid: "#1E293B",
    axis: "#94A3B8",
    bar: "#6366F1",
    line: "#22D3EE",
    barAlt: "#818CF8",
    border: "border-slate-800",
    divide: "divide-slate-800",
    head: "text-slate-400",
    emptyBox: "border-dashed border-slate-700 text-slate-400",
    toggleOn: "bg-indigo-600 text-white ring-indigo-500",
    toggleOff: "bg-slate-900 text-slate-300 ring-slate-700 hover:bg-slate-800",
    error: "border-red-500/30 bg-red-500/10 text-red-200",
    skeleton: "bg-slate-800",
  },
} as const;
type Theme = (typeof THEMES)[keyof typeof THEMES];

const TOPIC_LABELS: Record<string, string> = {
  price: "Price",
  shipping: "Shipping and delivery",
  returns: "Returns and refunds",
  payment: "Payment",
  availability: "Stock, colours and sizes",
  ordering: "Placing an order",
};

const FOCUS_RING = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2";

const dayLabel = (day: string, long = false) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString(undefined, long ? { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" } : { month: "short", day: "numeric", timeZone: "UTC" });

function NoData({ t, text, testId }: { t: Theme; text: string; testId: string }) {
  return (
    <p data-testid={testId} className={`rounded-xl border p-6 text-center text-sm ${t.emptyBox}`}>
      {text}
    </p>
  );
}

function niceMax(n: number): number {
  if (n <= 4) return 4;
  const pow = 10 ** Math.floor(Math.log10(n));
  return Math.ceil(n / pow) * pow;
}

function DailyChart({ t, daily }: { t: Theme; daily: AnalyticsDto["daily"] }) {
  const W = 640;
  const H = 240;
  const left = 36;
  const right = 12;
  const top = 14;
  const bottom = 30;
  const max = niceMax(Math.max(...daily.map((d) => d.buyerMessages), ...daily.map((d) => d.threads)));
  const plotW = W - left - right;
  const plotH = H - top - bottom;
  const step = plotW / daily.length;
  const y = (v: number) => Math.round((top + plotH - (v / max) * plotH) * 10) / 10;
  const x = (i: number) => Math.round((left + step * i + step / 2) * 10) / 10;
  const every = daily.length > 10 ? 5 : 1;
  const line = daily.map((d, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(d.threads)}`).join(" ");
  const ticks = [0, max / 4, max / 2, (max * 3) / 4, max];
  const total = daily.reduce((n, d) => n + d.buyerMessages, 0);

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Customer messages and active conversations per day. ${total} customer messages in this period.`} className="h-auto w-full" data-testid="chart-daily">
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={left} x2={W - right} y1={y(tick)} y2={y(tick)} stroke={t.grid} />
            <text x={left - 6} y={y(tick) + 3} textAnchor="end" fontSize="10" fill={t.axis}>
              {Math.round(tick)}
            </text>
          </g>
        ))}
        {daily.map((d, i) => (
          <g key={d.day}>
            <rect x={x(i) - step * 0.3} y={y(d.buyerMessages)} width={step * 0.6} height={Math.max(0, top + plotH - y(d.buyerMessages))} rx="2" fill={t.bar} fillOpacity="0.7">
              <title>{`${dayLabel(d.day, true)}: ${d.buyerMessages} customer messages, ${d.threads} conversations`}</title>
            </rect>
            {i % every === 0 && (
              <text x={x(i)} y={H - 10} textAnchor="middle" fontSize="10" fill={t.axis}>
                {dayLabel(d.day)}
              </text>
            )}
          </g>
        ))}
        <path d={line} fill="none" stroke={t.line} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {daily.length <= 10 && daily.map((d, i) => <circle key={`p-${d.day}`} cx={x(i)} cy={y(d.threads)} r="3" fill={t.line} />)}
      </svg>
      <div className={`mt-2 flex flex-wrap gap-4 text-xs ${t.muted}`}>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: t.bar }} />Customer messages</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4" style={{ backgroundColor: t.line }} />Active conversations</span>
      </div>
      <table className="sr-only">
        <caption>Customer messages and active conversations per day</caption>
        <thead>
          <tr><th scope="col">Day</th><th scope="col">Customer messages</th><th scope="col">Active conversations</th></tr>
        </thead>
        <tbody>
          {daily.map((d) => (
            <tr key={d.day}><th scope="row">{dayLabel(d.day, true)}</th><td>{d.buyerMessages}</td><td>{d.threads}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BarList({ t, id, items }: { t: Theme; id: string; items: { key: string; label: string; count: number }[] }) {
  const max = Math.max(...items.map((i) => i.count), 1);
  const total = items.reduce((n, i) => n + i.count, 0);
  return (
    <ul className="space-y-3" data-testid={`barlist-${id}`}>
      {items.map((it) => (
        <li key={it.key} data-testid={`barlist-${id}-${it.key}`}>
          <div className="flex justify-between text-sm">
            <span className={t.body}>{it.label}</span>
            <span className={`tabular-nums ${t.muted}`}>{it.count}{id === "languages" && total > 0 ? ` (${Math.round((it.count / total) * 100)}%)` : ""}</span>
          </div>
          <svg viewBox="0 0 100 6" preserveAspectRatio="none" className="mt-1 h-2 w-full" role="img" aria-label={`${it.label}: ${it.count}`}>
            <rect width="100" height="6" rx="3" fill={t.track} />
            <rect width={(it.count / max) * 100} height="6" rx="3" fill={t.barAlt} />
          </svg>
        </li>
      ))}
    </ul>
  );
}

function Kpi({ t, id, label, value, hint }: { t: Theme; id: string; label: string; value: string | null; hint: string }) {
  return (
    <li data-testid={`kpi-${id}`} className={t.card}>
      <p className={t.label}>{label}</p>
      <p className={`mt-1.5 ${value === null ? `text-lg leading-9 font-semibold ${t.muted}` : t.value}`} data-testid={`kpi-${id}-value`}>
        {value ?? "No data yet"}
      </p>
      <p className={`mt-1 text-xs ${t.muted}`}>{hint}</p>
    </li>
  );
}

export default function AnalyticsView({ theme }: { theme: "light" | "dark" }) {
  const t = THEMES[theme];
  const [days, setDays] = useState<7 | 30>(7);
  const [tz] = useState(browserTimeZone);
  const { data, error, loading, reload } = useApi<AnalyticsDto>(`/api/desk/analytics?days=${days}&tz=${encodeURIComponent(tz)}`);

  const empty = data !== null && data.totals.threads === 0 && data.funnel.ordersProposed === 0;

  return (
    <div className="space-y-5" data-testid="analytics-view">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className={t.sub}>Every figure is calculated from your stored conversations and orders. Where there is nothing to calculate from, it shows No data yet.</p>
        <div role="group" aria-label="Time range" className="flex gap-2" data-testid="analytics-range">
          {([7, 30] as const).map((d) => (
            <button key={d} type="button" aria-pressed={days === d} onClick={() => setDays(d)} data-testid={`analytics-range-${d}`} className={`rounded-full px-3 py-1.5 text-sm font-medium ring-1 ${days === d ? t.toggleOn : t.toggleOff} ${FOCUS_RING}`}>
              Last {d} days
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div role="status" aria-busy="true" data-testid="analytics-loading" className="grid gap-3 sm:grid-cols-3">
          <span className="sr-only">Loading analytics</span>
          {[0, 1, 2].map((i) => (
            <div key={i} className={`h-28 animate-pulse rounded-2xl motion-reduce:animate-none ${t.skeleton}`} />
          ))}
        </div>
      )}
      {error && !data && (
        <div role="alert" data-testid="analytics-error" className={`flex flex-wrap items-center gap-3 rounded-2xl border p-4 text-sm ${t.error}`}>
          <p className="min-w-0 flex-1">{error}</p>
          <button type="button" onClick={reload} data-testid="analytics-retry" className={`rounded-full px-3 py-1.5 text-sm font-medium ring-1 ${t.toggleOff} ${FOCUS_RING}`}>
            Try again
          </button>
        </div>
      )}

      {data && (
        <>
          {empty && (
            <p data-testid="analytics-empty" className={`rounded-2xl border p-5 text-sm ${t.emptyBox}`}>
              No conversations or orders in the last {data.days} days yet. Charts fill in as customers write to your shop.
            </p>
          )}

          <ul className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6" data-testid="analytics-kpis">
            <Kpi t={t} id="conversations" label="Conversations" value={String(data.totals.threads)} hint="Customers who wrote in this period." />
            <Kpi t={t} id="revenue" label="Revenue" value={data.funnel.ordersConfirmed === 0 ? null : formatUsd(data.totals.revenueUsd)} hint="Confirmed orders, excluding cancelled ones." />
            <Kpi t={t} id="ai-resolved" label="Handled by AI" value={data.totals.aiResolvedPercent === null ? null : `${data.totals.aiResolvedPercent}%`} hint="Conversations that did not need an agent." />
            <Kpi t={t} id="first-response" label="First response" value={data.totals.avgFirstResponseMinutes === null ? null : formatMinutes(data.totals.avgFirstResponseMinutes)} hint="Handoff to the first agent reply." />
            <Kpi t={t} id="resolution" label="Resolution time" value={data.totals.avgResolutionMinutes === null ? null : formatMinutes(data.totals.avgResolutionMinutes)} hint="Handoff to resolved, for agent-handled conversations." />
            <Kpi t={t} id="rating" label="Customer rating" value={data.totals.avgRating === null ? null : `${data.totals.avgRating.toFixed(1)} / 5`} hint={data.totals.ratingCount === 0 ? "No customer has rated a conversation." : `${data.totals.ratingCount} ${data.totals.ratingCount === 1 ? "rating" : "ratings"}.`} />
          </ul>

          <div className="grid gap-5 lg:grid-cols-3">
            <section className={`${t.card} lg:col-span-2`} aria-label="Conversations per day" data-testid="chart-card-daily">
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className={t.heading}>Customer activity per day</h2>
                <p className={`text-xs ${t.muted}`}>
                  {data.totals.buyerMessages} customer · {data.totals.aiMessages} AI · {data.totals.staffMessages} agent messages
                </p>
              </div>
              {data.totals.buyerMessages === 0 ? <NoData t={t} testId="chart-daily-empty" text="No customer messages in this period." /> : <DailyChart t={t} daily={data.daily} />}
            </section>

            <section className={t.card} aria-label="Conversation funnel" data-testid="funnel-card">
              <h2 className={t.heading}>From conversation to order</h2>
              <p className={`mb-3 text-xs ${t.muted}`}>Counts for this period. Orders can come from earlier conversations.</p>
              {data.funnel.conversations === 0 && data.funnel.ordersProposed === 0 ? (
                <NoData t={t} testId="funnel-empty" text="No data yet." />
              ) : (
                <BarList
                  t={t}
                  id="funnel"
                  items={[
                    { key: "conversations", label: "Conversations", count: data.funnel.conversations },
                    { key: "handoffs", label: "Handed to an agent", count: data.funnel.handoffs },
                    { key: "proposed", label: "Orders proposed", count: data.funnel.ordersProposed },
                    { key: "confirmed", label: "Orders confirmed", count: data.funnel.ordersConfirmed },
                  ]}
                />
              )}
              {data.totals.handoffRate !== null && (
                <p className={`mt-3 text-xs ${t.muted}`} data-testid="handoff-rate">Handoff rate: {Math.round(data.totals.handoffRate * 100)}% of conversations.</p>
              )}
            </section>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <section className={t.card} aria-label="Customer languages" data-testid="languages-card">
              <h2 className={`${t.heading} mb-3`}>Conversations by customer language</h2>
              {data.languages.length === 0 ? <NoData t={t} testId="languages-empty" text="No data yet." /> : <BarList t={t} id="languages" items={data.languages.map((l) => ({ key: l.language, label: l.language, count: l.count }))} />}
            </section>
            <section className={t.card} aria-label="Topics" data-testid="topics-card">
              <h2 className={t.heading}>What customers ask about</h2>
              <p className={`mb-3 text-xs ${t.muted}`}>Messages matched to a topic by keyword. One message can match more than one topic.</p>
              {data.topics.every((x) => x.count === 0) ? <NoData t={t} testId="topics-empty" text="No data yet." /> : <BarList t={t} id="topics" items={data.topics.map((x) => ({ key: x.topic, label: TOPIC_LABELS[x.topic] ?? x.topic, count: x.count }))} />}
            </section>
          </div>

          <section className={`${t.card} overflow-x-auto`} aria-label="Agent performance" data-testid="agent-performance-card">
            <h2 className={t.heading}>Agent performance</h2>
            <p className={`mb-3 text-xs ${t.muted}`}>Conversations in which the agent sent a reply, and the average time from handoff to the first reply.</p>
            {data.agents.length === 0 ? (
              <NoData t={t} testId="agents-empty" text="No team members yet." />
            ) : (
              <table className="w-full min-w-[420px] text-left text-sm" data-testid="agent-performance-table">
                <thead className={`border-b text-xs uppercase tracking-wide ${t.border} ${t.head}`}>
                  <tr>
                    <th scope="col" className="py-2 pr-3 font-semibold">Agent</th>
                    <th scope="col" className="py-2 pr-3 text-right font-semibold">Conversations handled</th>
                    <th scope="col" className="py-2 text-right font-semibold">First response</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${t.divide}`}>
                  {data.agents.map((a) => (
                    <tr key={a.id} data-testid={`agent-perf-row-${a.id}`}>
                      <th scope="row" className={`py-2.5 pr-3 font-medium ${t.body}`}>{a.name}</th>
                      <td className={`py-2.5 pr-3 text-right tabular-nums ${t.body}`}>{a.handled}</td>
                      <td className={`py-2.5 text-right tabular-nums ${a.avgFirstResponseMinutes === null ? t.muted : t.body}`}>{formatMinutes(a.avgFirstResponseMinutes)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {data.totals.ratingCount > 0 && (
              <p className={`mt-3 inline-flex items-center gap-1 text-xs ${t.muted}`}>
                <Star className="h-3.5 w-3.5" aria-hidden="true" />
                Ratings are given per conversation and are not attributed to a single agent.
              </p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
