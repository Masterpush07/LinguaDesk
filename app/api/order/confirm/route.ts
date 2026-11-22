import { NextResponse, type NextRequest } from "next/server";
import { parseOrderCard } from "@/lib/catalog";
import { db } from "@/lib/db";
import { sendDirectText } from "@/lib/nexconn-server";
import { CUSTOMER_ID } from "@/lib/owner-auth";
import { SHOP_ID } from "@/lib/shop";
import { legacyEnabled, legacyOff } from "@/lib/legacy";

const ORDER_ID = /^[0-9a-f-]{36}$/;

// The customer taps "Confirm order" on a card. Only someone holding the card's random ID can confirm it,
// and a second tap does nothing, so the owner is alerted exactly once.
export async function POST(req: NextRequest) {
  if (!legacyEnabled()) return legacyOff();
  const body = (await req.json().catch(() => null)) as {
    customerId?: unknown;
    orderId?: unknown;
  } | null;
  const customerId =
    typeof body?.customerId === "string" ? body.customerId : "";
  const orderId = typeof body?.orderId === "string" ? body.orderId : "";
  if (!CUSTOMER_ID.test(customerId) || !ORDER_ID.test(orderId))
    return NextResponse.json({ error: "Bad request" }, { status: 400 });

  const sql = db();
  const claimed =
    await sql`UPDATE orders SET status = 'confirmed', confirmed_at = now()
    WHERE id = ${orderId} AND customer_id = ${customerId} AND status = 'proposed' RETURNING card`;
  if (claimed.length === 0) {
    const [existing] =
      await sql`SELECT status FROM orders WHERE id = ${orderId} AND customer_id = ${customerId}`;
    if (!existing)
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    return NextResponse.json({ ok: true, alreadyConfirmed: true });
  }

  const card = parseOrderCard(JSON.stringify(claimed[0].card));
  if (!card)
    return NextResponse.json(
      { error: "Order data is invalid" },
      { status: 500 },
    );

  // The thank-you is automatic, so it goes out as an AI-labelled shop message, tagged so the card can show "confirmed".
  const thanks = card.labels.confirmed;
  const sent = await sendDirectText(SHOP_ID, customerId, thanks, {
    ai: true,
    metadata: { orderConfirmed: orderId },
  });
  const messageId = sent.messageIds?.[0]?.messageId ?? crypto.randomUUID();
  const english = "Order confirmed. Thank you!";
  const lines = card.lines.map((l) => `${l.qty} x ${l.name}`).join(", ");
  await sql`INSERT INTO messages (id, customer_id, sender, text, text_en)
    VALUES (${messageId}, ${customerId}, 'ai', ${thanks}, ${thanks === english ? null : english}) ON CONFLICT DO NOTHING`;
  await sql`UPDATE conversations SET status = 'waiting', last_text = ${`Order confirmed: $${card.total}`}, last_at = now(),
    summary = ${`The customer confirmed the order (${lines}, total $${card.total}). Next step: arrange payment and shipping.`}
    WHERE customer_id = ${customerId}`;
  return NextResponse.json({ ok: true });
}
