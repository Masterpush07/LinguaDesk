import { NextResponse, type NextRequest } from "next/server";
import { translateForCustomer } from "@/lib/bot-ai";
import { db } from "@/lib/db";
import { sendDirectText } from "@/lib/nexconn-server";
import { sameNumbers } from "@/lib/number-check";
import { CUSTOMER_ID, isOwner } from "@/lib/owner-auth";
import { SHOP_ID } from "@/lib/shop";

// Owner reply: written in English, translated into the language the customer last wrote in, number-checked, then sent.
export async function POST(req: NextRequest) {
  if (!(await isOwner())) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { customerId?: unknown; text?: unknown } | null;
  const customerId = typeof body?.customerId === "string" ? body.customerId : "";
  const text = typeof body?.text === "string" ? body.text.trim().slice(0, 1000) : "";
  if (!CUSTOMER_ID.test(customerId) || !text) return NextResponse.json({ error: "Bad request" }, { status: 400 });

  const sql = db();
  const [conversation] = await sql`SELECT customer_id FROM conversations WHERE customer_id = ${customerId}`;
  if (!conversation) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // The customer's latest message decides the language, so a stale or missing saved language can never cause an untranslated reply.
  const [last] = await sql`SELECT text, text_en FROM messages
    WHERE customer_id = ${customerId} AND sender = 'customer' ORDER BY created_at DESC LIMIT 1`;
  // text_en identical to text means the AI already confirmed the customer writes English.
  const customerIsEnglish = !!last?.text_en && last.text_en.trim() === last.text.trim();

  let outgoing = text;
  if (last && !customerIsEnglish) {
    try {
      outgoing = await translateForCustomer(text, last.text);
    } catch (err) {
      console.error("Owner reply translation failed:", err instanceof Error ? err.message : err);
      return NextResponse.json({ error: "Translation is unavailable right now. Try again in a moment." }, { status: 502 });
    }
    if (!sameNumbers(text, outgoing)) {
      return NextResponse.json(
        { error: "The translation changed a number, so nothing was sent. Reword the message and try again." },
        { status: 422 },
      );
    }
  }

  const sent = await sendDirectText(SHOP_ID, customerId, outgoing);
  const messageId = sent.messageIds?.[0]?.messageId ?? crypto.randomUUID();
  // text = what the customer received, text_en = the owner's original; the webhook skips server-sent messages.
  await sql`INSERT INTO messages (id, customer_id, sender, text, text_en)
    VALUES (${messageId}, ${customerId}, 'owner', ${outgoing}, ${outgoing === text ? null : text}) ON CONFLICT DO NOTHING`;
  await sql`UPDATE conversations SET status = 'human', last_text = ${text}, last_at = now() WHERE customer_id = ${customerId}`;
  return NextResponse.json({ ok: true });
}
