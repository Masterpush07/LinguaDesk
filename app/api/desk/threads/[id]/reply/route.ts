import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { sendDirectText } from "@/lib/nexconn-server";
import { sameNumbers } from "@/lib/number-check";
import { newId } from "@/lib/v2/crypto";
import { requireStaff } from "@/lib/v2/guard";
import { canWork, fail, loadHead, NOT_YOURS, readBody } from "@/lib/v2/desk-threads";
import { recordStaffSend } from "@/lib/v2/desk-send";
import { buyerSample, renderForBuyer } from "@/lib/v2/desk-translate";
import { logEvent } from "@/lib/v2/threads";

type Ctx = { params: Promise<{ id: string }> };

// A team member writes in English; the buyer receives their own language. Nothing is sent if a number would change.
export async function POST(req: NextRequest, ctx: Ctx) {
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;
  const { staff } = auth;
  const { id } = await ctx.params;
  const body = await readBody(req);
  const text = typeof body?.text === "string" ? body.text.trim().slice(0, 1000) : "";
  if (!text) return fail(400, "Write a message first.");
  const sendOriginal = body?.sendOriginal === true;
  const supplied = typeof body?.translation === "string" ? body.translation.trim().slice(0, 2000) : "";
  const voiceSeconds = typeof body?.voiceSeconds === "number" && Number.isInteger(body.voiceSeconds) && body.voiceSeconds > 0 ? body.voiceSeconds : null;

  const thread = await loadHead(staff, id);
  if (!thread) return fail(404, "Conversation not found.");
  if (thread.status === "resolved") return fail(409, "This conversation is resolved. Reopen it before replying.");
  if (!canWork(staff, thread)) return fail(403, NOT_YOURS);

  const sample = await buyerSample(id);
  let outgoing = text;
  let verified = true;
  if (sendOriginal) {
    verified = !sample || sample.english;
  } else if (supplied && sample && !sample.english) {
    // The agent already reviewed this translation in the preview, so it is sent as shown.
    if (!sameNumbers(text, supplied)) return fail(422, "The translation changed a number, so nothing was sent. Reword the message and try again.");
    outgoing = supplied;
  } else {
    try {
      const rendered = await renderForBuyer(text, sample, false);
      if (!rendered.numbersOk) return fail(422, "The translation changed a number, so nothing was sent. Reword the message and try again.");
      outgoing = rendered.translated;
    } catch (err) {
      console.error("Desk reply translation failed:", err instanceof Error ? err.message : err);
      return fail(502, "Translation is unavailable right now. Retry, or send your original English message.");
    }
  }

  let messageId: string;
  try {
    const sent = await sendDirectText(staff.nexconnUserId, thread.buyer.id, outgoing);
    messageId = sent.messageIds?.[0]?.messageId ?? newId("msg");
  } catch (err) {
    console.error("Desk reply send failed:", err instanceof Error ? err.message : err);
    return fail(502, "The message could not be delivered. Try again in a moment.");
  }

  // text is what the buyer received, text_en the agent's original; the webhook skips server-sent messages.
  await db()`INSERT INTO thread_messages (id, thread_id, sender, staff_id, text, text_en, lang, voice_seconds, numbers_verified)
    VALUES (${messageId}, ${id}, 'staff', ${staff.id}, ${outgoing}, ${outgoing === text ? null : text}, ${thread.language}, ${voiceSeconds}, ${verified})
    ON CONFLICT DO NOTHING`;
  await recordStaffSend(staff, thread, text);
  await logEvent(id, "replied", "staff", { staffId: staff.id, name: staff.name, translated: outgoing !== text, original: sendOriginal });
  return NextResponse.json({ ok: true, messageId, sent: outgoing, thread: await loadHead(staff, id) });
}
