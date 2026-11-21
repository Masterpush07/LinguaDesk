"use client";

import { useEffect, useState } from "react";
import { Timer } from "lucide-react";
import { useNow } from "@/lib/v2/desk-client";

const fmt = (s: number) => {
  const abs = Math.abs(s);
  const hh = Math.floor(abs / 3600);
  const mm = String(Math.floor((abs % 3600) / 60)).padStart(2, "0");
  const ss = String(abs % 60).padStart(2, "0");
  return `${hh > 0 ? `${hh}:` : ""}${mm}:${ss}`;
};

function Chip({ now, pending = false }: { now: number; pending?: boolean }) {
  const tone = pending
    ? "bg-slate-700/40 text-slate-300 ring-slate-600"
    : now < 0
      ? "bg-red-500/15 text-red-300 ring-red-400/30"
      : now < 600
        ? "bg-amber-400/10 text-amber-300 ring-amber-400/30"
        : "bg-emerald-400/10 text-emerald-300 ring-emerald-400/30";
  return (
    <span
      data-testid="sla-chip"
      title={pending ? "Calculating the time remaining" : now < 0 ? "First-response target missed" : "Time remaining to reply"}
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-[10px] font-semibold tabular-nums ring-1 ${tone}`}
    >
      <Timer className="h-3 w-3" aria-hidden="true" />
      {pending ? "--:--" : now < 0 ? `Overdue ${fmt(now)}` : fmt(now)}
    </span>
  );
}

// Countdown to a real deadline. Green = plenty of time, amber = under 10 minutes, red = target missed (counts up).
function DueChip({ dueAt }: { dueAt: string }) {
  const now = useNow();
  if (!now) return <Chip now={0} pending />;
  return <Chip now={Math.round((new Date(dueAt).getTime() - now) / 1000)} />;
}

// Fixed-length countdown used by the marketing demo.
function SecondsChip({ seconds, live }: { seconds: number; live: boolean }) {
  const [clock, setClock] = useState({ base: seconds, elapsed: 0 });
  // A new target restarts the countdown; adjusting state during render avoids an extra effect pass.
  if (clock.base !== seconds) setClock({ base: seconds, elapsed: 0 });
  const now = seconds - (clock.base === seconds ? clock.elapsed : 0);

  useEffect(() => {
    if (!live) return;
    const id = setInterval(() => setClock((c) => ({ ...c, elapsed: c.elapsed + 1 })), 1000);
    return () => clearInterval(id);
  }, [live]);

  return <Chip now={now} />;
}

type Props = { dueAt: string } | { seconds: number; live?: boolean };

export default function SlaChip(props: Props) {
  return "dueAt" in props ? <DueChip dueAt={props.dueAt} /> : <SecondsChip seconds={props.seconds} live={props.live ?? true} />;
}
