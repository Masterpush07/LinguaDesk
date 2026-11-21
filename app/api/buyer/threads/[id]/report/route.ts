import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { isLimited, recordEvent } from "@/lib/rate-limit";
import { notFound, requireBuyer } from "@/lib/v2/buyer-api";
import { newId } from "@/lib/v2/crypto";
import { notifyShop } from "@/lib/v2/notifications";
import { Check, fail, invalidBody, readJson } from "@/lib/v2/seller-api";
import { logEvent } from "@/lib/v2/threads";
import { REPORT_COMMENT_MAX, REPORT_REASON_LABEL, REPORT_REASONS } from "@/lib/v2/translation-report";

const REPORTS_PER_HOUR = 10;

// A buyer says a translated message looks wrong. The shop team is told and sees both texts side by side.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireBuyer();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const body = await readJson(req);
  if (!body) return invalidBody();

  const check = new Check();
  const reason = check.oneOf(body.reason, "Reason", REPORT_REASONS);
  const comment = check.text(body.comment, "Comment", REPORT_COMMENT_MAX);
  const messageId = typeof body.messageId === "string" ? body.messageId.slice(0, 120) : "";
  if (!messageId) check.errors.push("Choose the message to report.");
  if (!check.ok) return check.response;

  const sql = db();
  const [thread] = await sql`SELECT id, seller_id FROM threads WHERE id = ${id} AND buyer_id = ${auth.buyerId}`;
  if (!thread) return notFound("Conversation");
  const [message] = await sql`SELECT id, sender, text, text_en FROM thread_messages WHERE id = ${messageId} AND thread_id = ${id}`;
  if (!message || message.sender === "system") return notFound("Message");
  // Only a message that really has two versions can be a bad translation.
  const english = typeof message.text_en === "string" ? message.text_en.trim() : "";
  if (!english || english === String(message.text).trim()) return fail("That message was not translated, so there is nothing to report.", 400);

  const key = `report:${auth.buyerId}`;
  if (await isLimited(key, REPORTS_PER_HOUR, 60)) return fail("You have sent many reports. Please try again later.", 429);

  // The writer's version first, then what the other side was shown.
  const fromBuyer = message.sender === "buyer";
  const original = fromBuyer ? message.text : english;
  const translated = fromBuyer ? english : message.text;
  const created = await sql`INSERT INTO translation_reports (id, seller_id, thread_id, buyer_id, message_id, reason, comment, sender, original_text, translated_text)
    VALUES (${newId("trr")}, ${thread.seller_id}, ${id}, ${auth.buyerId}, ${messageId}, ${reason}, ${comment}, ${message.sender}, ${String(original).slice(0, 2000)}, ${String(translated).slice(0, 2000)})
    ON CONFLICT (message_id, buyer_id) DO NOTHING RETURNING id`;
  if (created.length === 0) return fail("You already reported this message.", 409);

  await recordEvent(key);
  await logEvent(id, "translation_reported", "buyer", { messageId, reason }).catch(() => undefined);
  await notifyShop(thread.seller_id, id, "translation_reported", "A customer reported a translation", `${REPORT_REASON_LABEL[reason]}${comment ? `: ${comment}` : ""}`);
  return NextResponse.json({ ok: true }, { status: 201 });
}
