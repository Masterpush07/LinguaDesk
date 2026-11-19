import { db } from "@/lib/db";

// Server-only. Thread history and dispatch (who handles a conversation the AI cannot).

export async function logEvent(threadId: string, type: string, actor: string, payload: Record<string, unknown> = {}) {
  await db()`INSERT INTO thread_events (thread_id, type, actor, payload) VALUES (${threadId}, ${type}, ${actor}, ${JSON.stringify(payload)}::jsonb)`;
}

const ONLINE_SECONDS = 90; // a staff member counts as online if their desk pinged within this window
export const STAFF_SILENCE_MINUTES = 30; // after this long without a staff reply the AI answers again

// Picks the best available team member for a waiting thread and assigns it atomically.
// Preference: speaks the buyer's language, then the lowest current load. Returns the staff id, or null when nobody is free.
export async function dispatch(threadId: string, sellerId: string, buyerLanguage: string | null): Promise<string | null> {
  const sql = db();
  const candidates = await sql`SELECT st.id, st.name, st.languages, st.max_concurrent,
      (SELECT count(*) FROM threads t WHERE t.assigned_staff_id = st.id AND t.status = 'assigned')::int AS load
    FROM staff st
    WHERE st.seller_id = ${sellerId} AND st.available AND st.last_seen > now() - make_interval(secs => ${ONLINE_SECONDS})`;
  const free = candidates.filter((c) => c.load < c.max_concurrent);
  if (free.length === 0) return null;
  const code = (buyerLanguage ?? "").slice(0, 2).toLowerCase();
  free.sort((a, b) => {
    const am = a.languages.includes(code) ? 0 : 1;
    const bm = b.languages.includes(code) ? 0 : 1;
    return am - bm || a.load / a.max_concurrent - b.load / b.max_concurrent;
  });
  const pick = free[0];
  const done = await sql`UPDATE threads SET status = 'assigned', assigned_staff_id = ${pick.id}
    WHERE id = ${threadId} AND status = 'waiting' AND assigned_staff_id IS NULL RETURNING id`;
  if (done.length === 0) return null;
  await logEvent(threadId, "assigned", "dispatch", { staffId: pick.id, name: pick.name, language: code || null, load: pick.load });
  return pick.id;
}

// Complaints and refunds are raised in priority; explicit urgency becomes critical.
export function priorityFor(text: string): "normal" | "high" | "critical" {
  if (/\b(asap|immediately|urgent|right now|emergency)\b/i.test(text)) return "critical";
  if (/\b(refund|broken|damaged|wrong item|not received|complain|scam|cancel)\b/i.test(text)) return "high";
  return "normal";
}
