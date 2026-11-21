import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { newId } from "@/lib/v2/crypto";
import type { LearnItem, LearnResponse } from "@/lib/v2/learn-types";
import { requireStaff } from "@/lib/v2/guard";
import { Check, fail, invalidBody, LIMITS, readJson } from "@/lib/v2/seller-api";
import { logEvent } from "@/lib/v2/threads";

const LOOKBACK_DAYS = 60;
const MAX_ITEMS = 20;


// Conversations the assistant handed over (or the buyer asked for the shop), with the owner's first reply as a suggested answer.
export async function GET() {
  const auth = await requireStaff({ owner: true });
  if ("error" in auth) return auth.error;
  const rows = await db()`SELECT t.id AS thread_id, q.asked_at, q.question, a.answer, count(*) OVER () AS total
    FROM threads t
    JOIN LATERAL (
      SELECT at FROM thread_events
      WHERE thread_id = t.id AND type = 'handoff' AND payload->>'reason' IN ('ai_requested', 'buyer_requested')
        AND at > now() - make_interval(days => ${LOOKBACK_DAYS})
      ORDER BY at DESC LIMIT 1
    ) h ON true
    JOIN LATERAL (
      SELECT coalesce(nullif(trim(m.text_en), ''), m.text) AS question, m.created_at AS asked_at
      FROM thread_messages m
      WHERE m.thread_id = t.id AND m.sender = 'buyer' AND m.created_at <= h.at
      ORDER BY m.created_at DESC LIMIT 1
    ) q ON true
    LEFT JOIN LATERAL (
      SELECT coalesce(nullif(trim(m.text_en), ''), m.text) AS answer
      FROM thread_messages m
      WHERE m.thread_id = t.id AND m.sender = 'staff' AND m.created_at > h.at
      ORDER BY m.created_at LIMIT 1
    ) a ON true
    WHERE t.seller_id = ${auth.staff.sellerId}
      AND NOT EXISTS (SELECT 1 FROM faqs f WHERE f.source_thread_id = t.id)
      AND NOT EXISTS (SELECT 1 FROM thread_events e WHERE e.thread_id = t.id AND e.type IN ('learn_dismissed', 'learn_saved'))
    ORDER BY h.at DESC
    LIMIT ${MAX_ITEMS}`;

  const items = rows.map((r): LearnItem => {
    const answer = typeof r.answer === "string" ? r.answer.trim().slice(0, LIMITS.faqAnswer) : "";
    return {
      threadId: r.thread_id,
      question: String(r.question).trim().slice(0, LIMITS.faqQuestion),
      askedAt: new Date(r.asked_at).toISOString(),
      suggestedAnswer: answer,
      answered: answer.length > 0,
    };
  });
  return NextResponse.json({ items, total: rows.length > 0 ? Number(rows[0].total) : 0 } satisfies LearnResponse);
}

// Saves a conversation as a knowledge base answer, or dismisses it so it no longer appears in the list.
export async function POST(req: NextRequest) {
  const auth = await requireStaff({ owner: true });
  if ("error" in auth) return auth.error;
  const body = await readJson(req);
  if (!body) return invalidBody();
  const threadId = typeof body.threadId === "string" ? body.threadId : "";
  if (!threadId) return fail("Choose a conversation.");
  if (body.action !== "save" && body.action !== "dismiss") return fail("The action must be save or dismiss.");

  const sql = db();
  const [thread] = await sql`SELECT id FROM threads WHERE id = ${threadId} AND seller_id = ${auth.staff.sellerId}`;
  if (!thread) return fail("Conversation not found.", 404);

  if (body.action === "dismiss") {
    await logEvent(threadId, "learn_dismissed", auth.staff.id);
    return NextResponse.json({ ok: true });
  }

  const check = new Check();
  const q = check.text(body.question, "Question", LIMITS.faqQuestion, true);
  const a = check.text(body.answer, "Answer", LIMITS.faqAnswer, true);
  if (!check.ok) return check.response;

  const [{ n }] = await sql`SELECT count(*)::int AS n FROM faqs WHERE seller_id = ${auth.staff.sellerId}`;
  if (n >= LIMITS.faqMax) return fail(`You can add at most ${LIMITS.faqMax} questions. Delete one before adding another.`);
  await sql`INSERT INTO faqs (id, seller_id, q, a, source_thread_id) VALUES (${newId("faq")}, ${auth.staff.sellerId}, ${q}, ${a}, ${threadId})`;
  await logEvent(threadId, "learn_saved", auth.staff.id);
  return NextResponse.json({ ok: true });
}
