import { NextResponse, type NextRequest } from "next/server";
import { parseOrderCard } from "@/lib/catalog";
import { db } from "@/lib/db";
import { sendDirectText } from "@/lib/nexconn-server";
import { notFound, requireBuyer, addSystemMessage } from "@/lib/v2/buyer-api";
import { newId } from "@/lib/v2/crypto";
import { validateDelivery } from "@/lib/v2/delivery";
import { confirmOrderWithStock } from "@/lib/v2/inventory";
import { notifyShop } from "@/lib/v2/notifications";
import { dispatch, logEvent } from "@/lib/v2/threads";

const ENGLISH_THANKS = "Order confirmed. Thank you.";

// The buyer confirms a proposed order and gives the delivery address. Claiming the order and taking its stock are one atomic statement (lib/v2/inventory.ts),
// so a second tap only reports that it is already confirmed and the last unit can never be sold twice.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireBuyer();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const sql = db();

  const body = (await req.json().catch(() => null)) as { delivery?: unknown } | null;
  const parsed = validateDelivery(body?.delivery);
  if (!parsed.ok) {
    // An order that is no longer waiting for confirmation keeps its old answers; only a waiting one needs an address.
    const [waiting] = await sql`SELECT status FROM orders_v2 WHERE id = ${id} AND buyer_id = ${auth.buyerId}`;
    if (!waiting) return notFound("Order");
    if (waiting.status === "proposed") return NextResponse.json({ error: parsed.error, field: parsed.field ?? null }, { status: 400 });
  }

  let claimed: { seller_id: string; card: unknown; total: number }[] = [];
  if (parsed.ok) {
    const result = await confirmOrderWithStock(id, auth.buyerId, parsed.delivery);
    if (result.kind === "out_of_stock") return soldOut(sql, id, auth.buyerId);
    if (result.kind === "confirmed") claimed = [result.order];
  }
  if (claimed.length === 0) {
    const [existing] = await sql`SELECT status FROM orders_v2 WHERE id = ${id} AND buyer_id = ${auth.buyerId}`;
    if (!existing) return notFound("Order");
    if (existing.status === "cancelled") return NextResponse.json({ error: "This order was cancelled by the shop." }, { status: 409 });
    return NextResponse.json({ ok: true, alreadyConfirmed: true });
  }

  const { seller_id: sellerId, total } = claimed[0];
  const card = parseOrderCard(JSON.stringify(claimed[0].card));
  const [ctx] = await sql`SELECT s.nexconn_user_id, s.response_target_min, t.id AS thread_id, t.language
    FROM sellers s LEFT JOIN threads t ON t.seller_id = s.id AND t.buyer_id = ${auth.buyerId} WHERE s.id = ${sellerId}`;
  if (!ctx?.thread_id) return NextResponse.json({ ok: true });
  const threadId: string = ctx.thread_id;

  // The thank-you is automatic, so it goes out as an AI-labelled shop message that the card can recognise as the confirmation.
  const thanks = card?.labels.confirmed ?? ENGLISH_THANKS;
  let messageId = newId("msg");
  try {
    const sent = await sendDirectText(ctx.nexconn_user_id, auth.buyerId, thanks, { ai: true, metadata: { orderConfirmed: id } });
    messageId = sent.messageIds?.[0]?.messageId ?? messageId;
  } catch (err) {
    console.error("order confirmation message failed:", err instanceof Error ? err.message : err);
  }
  await sql`INSERT INTO thread_messages (id, thread_id, sender, text, text_en, numbers_verified)
    VALUES (${messageId}, ${threadId}, 'ai', ${thanks}, ${thanks === ENGLISH_THANKS ? null : ENGLISH_THANKS}, true) ON CONFLICT DO NOTHING`;

  const lines = (card?.lines ?? []).map((l) => `${l.qty} x ${l.name}`).join(", ");
  const summary = `The buyer confirmed the order (${lines || "see the order"}, total $${total}). Ship to: ${parsed.ok ? [parsed.delivery.city, parsed.delivery.country].join(", ") : "see the order"}. Next step: arrange payment and shipping.`;
  // A conversation already with an agent or waiting keeps its place and assignment; anything else goes to the queue.
  const [thread] = await sql`UPDATE threads SET priority = CASE WHEN priority = 'critical' THEN priority ELSE 'high' END, summary = ${summary},
      last_text = ${`Order confirmed: $${total}`}, last_at = now(), resolved_at = NULL,
      handoff_at = CASE WHEN status IN ('assigned', 'waiting') THEN handoff_at ELSE now() END,
      sla_due_at = CASE WHEN status IN ('assigned', 'waiting') THEN sla_due_at ELSE now() + make_interval(mins => ${ctx.response_target_min}) END,
      first_response_at = CASE WHEN status IN ('assigned', 'waiting') THEN first_response_at ELSE NULL END,
      status = CASE WHEN status = 'assigned' THEN 'assigned' ELSE 'waiting' END
    WHERE id = ${threadId} RETURNING status, assigned_staff_id`;
  await logEvent(threadId, "order_confirmed", "buyer", { orderId: id, total });
  await notifyShop(sellerId, threadId, "order_confirmed", "An order was confirmed", `Order ${id}: ${lines || "see the order"}, total $${total}. Pack it and update its status in Orders.`);
  if (thread?.status === "waiting" && !thread.assigned_staff_id) await dispatch(threadId, sellerId, ctx.language);

  return NextResponse.json({ ok: true });
}

// The stock was taken by someone else after the card was sent. The order stays open and the shop is told, so nothing is lost silently.
async function soldOut(sql: ReturnType<typeof db>, orderId: string, buyerId: string) {
  const [order] = await sql`SELECT seller_id, thread_id FROM orders_v2 WHERE id = ${orderId} AND buyer_id = ${buyerId}`;
  if (order) {
    if (order.thread_id) await addSystemMessage(order.thread_id, `Order ${orderId} could not be confirmed because an item is no longer available in that quantity. The shop will contact you.`).catch(() => undefined);
    await notifyShop(order.seller_id, order.thread_id ?? null, "needs_reply", "An order could not be confirmed", `Order ${orderId}: the customer tried to confirm but stock has run out. Update the order or the stock.`);
  }
  return NextResponse.json({ error: "Sorry, an item in this order is no longer available in that quantity. The shop has been told and will contact you.", code: "out_of_stock" }, { status: 409 });
}
