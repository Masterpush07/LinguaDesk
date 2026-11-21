import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { isLimited, recordEvent } from "@/lib/rate-limit";
import { notFound, requireBuyer } from "@/lib/v2/buyer-api";
import { fail, invalidBody, readJson } from "@/lib/v2/seller-api";
import { synthesize, TTS_MAX_CHARS } from "@/lib/v2/tts";

const NEW_CLIPS_PER_BUYER_PER_HOUR = 20;
const NEW_CLIPS_PER_HOUR_ALL = 200; // keeps the shared free quota from being used up by one busy hour

const audio = (bytes: Buffer, mime: string) =>
  new NextResponse(new Uint8Array(bytes), { headers: { "Content-Type": mime, "Content-Length": String(bytes.length), "Cache-Control": "private, max-age=3600" } });

// Reads one message of the buyer's own conversation aloud. Only existing messages can be read, so this cannot be used as a general text-to-speech service.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireBuyer();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const body = await readJson(req);
  if (!body) return invalidBody();
  const messageId = typeof body.messageId === "string" ? body.messageId.slice(0, 120) : "";
  const variant = body.variant === "english" ? "english" : body.variant === "shown" ? "shown" : null;
  if (!messageId || !variant) return fail("Send the message id and whether to read the shown text or the English text.");

  const sql = db();
  const [message] = await sql`SELECT m.id, m.sender, m.text, m.text_en FROM thread_messages m JOIN threads t ON t.id = m.thread_id
    WHERE m.id = ${messageId} AND m.thread_id = ${id} AND t.buyer_id = ${auth.buyerId}`;
  if (!message || message.sender === "system") return notFound("Message");
  const text = String(variant === "english" ? (message.text_en ?? "") : message.text).trim();
  if (!text) return fail("That message has no English text to read.");

  const [cached] = await sql`SELECT mime, data FROM tts_cache WHERE message_id = ${messageId} AND variant = ${variant}`;
  if (cached) return audio(Buffer.from(cached.data as string, "base64"), cached.mime as string);

  const mine = `tts:${auth.buyerId}`;
  if ((await isLimited(mine, NEW_CLIPS_PER_BUYER_PER_HOUR, 60)) || (await isLimited("tts:all", NEW_CLIPS_PER_HOUR_ALL, 60))) {
    return fail("Read-aloud is busy right now. Please try again in a little while.", 429);
  }

  try {
    const speech = await synthesize(text.slice(0, TTS_MAX_CHARS));
    await recordEvent(mine);
    await recordEvent("tts:all");
    await sql`INSERT INTO tts_cache (message_id, variant, mime, data) VALUES (${messageId}, ${variant}, ${speech.mime}, ${speech.bytes.toString("base64")})
      ON CONFLICT (message_id, variant) DO NOTHING`;
    // Now and then drop old clips so the table stays small on the free database.
    if (Math.random() < 0.05) await sql`DELETE FROM tts_cache WHERE created_at < now() - interval '7 days'`.catch(() => undefined);
    return audio(speech.bytes, speech.mime);
  } catch (err) {
    console.error("read-aloud failed:", err instanceof Error ? err.message : err);
    return fail("Read-aloud is not available right now.", 503);
  }
}
