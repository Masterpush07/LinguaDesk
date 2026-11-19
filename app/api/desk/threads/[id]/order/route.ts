import { NextResponse, type NextRequest } from "next/server";
import { localizeOrder } from "@/lib/bot-ai";
import { ENGLISH_LABELS, orderSummary, priceOrder, type OrderCard } from "@/lib/catalog";
import { db } from "@/lib/db";
import { sendDirectText } from "@/lib/nexconn-server";
import { newId } from "@/lib/v2/crypto";
import { requireStaff } from "@/lib/v2/guard";
import { canWork, fail, loadHead, NOT_YOURS, readBody } from "@/lib/v2/desk-threads";
import { recordStaffSend } from "@/lib/v2/desk-send";
import { buyerSample } from "@/lib/v2/desk-translate";
import { loadShop } from "@/lib/v2/shop";
import { logEvent } from "@/lib/v2/threads";

type Ctx = { params: Promise<{ id: string }> };

// Sends an order card. Prices come from the shop's own catalogue in code; the AI only translates the card's words.
export async function POST(req: NextRequest, ctx: Ctx) {
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;
  const { staff } = auth;
  const { id } = await ctx.params;
  const body = await readBody(req);

  const thread = await loadHead(staff, id);
  if (!thread) return fail(404, "Conversation not found.");
  if (thread.status === "resolved") return fail(409, "This conversation is resolved. Reopen it before sending an order.");
  if (!canWork(staff, thread)) return fail(403, NOT_YOURS);

  const { shop } = await loadShop(staff.sellerId);
  const priced = priceOrder(body?.lines, shop);
  if (!priced) return fail(400, "These items cannot be ordered. Check that each product is in stock and the quantities are valid.");

  const english: OrderCard = {
    id: newId("ord"),
    lines: priced.lines.map(({ name, qty, unit, amount }) => ({ name, qty, unit, amount })),
    subtotal: priced.subtotal,
    shipping: priced.shipping,
    total: priced.total,
    labels: ENGLISH_LABELS,
  };

  let card = english;
  const sample = await buyerSample(id);
  if (sample && !sample.english) {
    try {
      const local = await localizeOrder(english.lines.map((l) => l.name), sample.text);
      if (local) card = { ...english, labels: local.labels, lines: english.lines.map((l, i) => ({ ...l, name: local.names[i] })) };
    } catch (err) {
      console.error("Order localization failed:", err instanceof Error ? err.message : err); // the English card is still correct
    }
  }

  const summary = orderSummary(card);
  const summaryEn = orderSummary(english);
  let messageId: string;
  try {
    const sent = await sendDirectText(staff.nexconnUserId, thread.buyer.id, summary, { metadata: { order: JSON.stringify(card) } });
    messageId = sent.messageIds?.[0]?.messageId ?? newId("msg");
  } catch (err) {
    console.error("Desk order send failed:", err instanceof Error ? err.message : err);
    return fail(502, "The order could not be delivered. Try again in a moment.");
  }

  const sql = db();
  await sql`INSERT INTO orders_v2 (id, seller_id, thread_id, buyer_id, card, total, status)
    VALUES (${card.id}, ${staff.sellerId}, ${id}, ${thread.buyer.id}, ${JSON.stringify(card)}::jsonb, ${card.total}, 'proposed')`;
  await sql`INSERT INTO thread_messages (id, thread_id, sender, staff_id, text, text_en, lang, numbers_verified, order_id)
    VALUES (${messageId}, ${id}, 'staff', ${staff.id}, ${summary}, ${summary === summaryEn ? null : summaryEn}, ${thread.language}, true, ${card.id})
    ON CONFLICT DO NOTHING`;
  await recordStaffSend(staff, thread, summaryEn);
  await logEvent(id, "order_sent", "staff", { staffId: staff.id, name: staff.name, orderId: card.id, total: card.total });
  return NextResponse.json({ ok: true, orderId: card.id, total: card.total, thread: await loadHead(staff, id) }, { status: 201 });
}
