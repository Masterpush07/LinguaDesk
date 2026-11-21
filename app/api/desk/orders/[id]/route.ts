import { NextResponse, after, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { sendDirectText } from "@/lib/nexconn-server";
import { newId } from "@/lib/v2/crypto";
import { requireStaff } from "@/lib/v2/guard";
import { alertBuyer } from "@/lib/v2/buyer-alert";
import { Check, fail, invalidBody, readJson } from "@/lib/v2/seller-api";
import { checkTransition, courtesyText, orderDto } from "@/lib/v2/seller-orders";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/v2/seller-types";
import { logEvent } from "@/lib/v2/threads";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const auth = await requireStaff({ owner: true });
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const body = await readJson(req);
  if (!body) return invalidBody();
  const { staff } = auth;

  const sql = db();
  const [current] = await sql`SELECT id, status, courier, tracking, buyer_id, thread_id FROM orders_v2 WHERE id = ${id} AND seller_id = ${staff.sellerId}`;
  if (!current) return fail("Order not found.", 404);
  const from = current.status as OrderStatus;

  const check = new Check();
  const to = "status" in body ? check.oneOf(body.status, "Status", ORDER_STATUSES) : from;
  const courier = "courier" in body ? check.text(body.courier, "Courier", 60) || null : (current.courier as string | null);
  const tracking = "tracking" in body ? check.text(body.tracking, "Tracking number", 80) || null : (current.tracking as string | null);
  if (!check.ok) return check.response;
  if (!("status" in body) && !("courier" in body) && !("tracking" in body)) return fail("Send a status, courier or tracking number to update.");

  const blocked = checkTransition(from, to);
  if (blocked) return fail(blocked, 409);
  const detailsChanged = courier !== current.courier || tracking !== current.tracking;
  if (detailsChanged && (from === "proposed" || from === "cancelled")) {
    return fail(`Courier details cannot be added to an order that is ${from}.`, 409);
  }

  // The status in WHERE makes concurrent updates safe: only one of two simultaneous requests can move the order.
  const [row] = await sql`UPDATE orders_v2 SET status = ${to}, courier = ${courier}, tracking = ${tracking}, updated_at = now()
    WHERE id = ${id} AND seller_id = ${staff.sellerId} AND status = ${from}
    RETURNING id, status, total, card, courier, tracking, created_at, confirmed_at, buyer_id, thread_id, delivery, paid_at`;
  if (!row) return fail("This order was changed by someone else. Reload and try again.", 409);

  let notified: boolean | undefined;
  if (to !== from && (to === "shipped" || to === "delivered")) {
    notified = await notifyBuyer(staff, { id: row.id, courier: row.courier, tracking: row.tracking, buyer_id: row.buyer_id, thread_id: row.thread_id }, to);
    const alert = () =>
      alertBuyer({
        buyerId: row.buyer_id,
        kind: to,
        ref: row.id,
        shopName: staff.sellerName,
        path: `/orders/${row.id}`,
        push: { title: `Order ${row.id} ${to}`, body: courtesyText({ id: row.id, courier: row.courier, tracking: row.tracking }, to), url: `/orders/${row.id}`, tag: `order-${row.id}` },
      });
    try {
      after(alert);
    } catch {
      void alert();
    }
  }
  if (to !== from && row.thread_id) {
    await logEvent(row.thread_id, "order_status", staff.id, { orderId: id, from, to }).catch(() => {});
  }
  return NextResponse.json({ ...orderDto(row), ...(notified === undefined ? {} : { notified }) });
}

// The status change is already saved. A failed notification is reported to the seller instead of undoing it.
async function notifyBuyer(
  staff: { nexconnUserId: string },
  order: { id: string; courier: string | null; tracking: string | null; buyer_id: string; thread_id: string | null },
  status: "shipped" | "delivered",
): Promise<boolean> {
  const text = courtesyText(order, status);
  try {
    const sent = await sendDirectText(staff.nexconnUserId, order.buyer_id, text, { ai: true });
    if (order.thread_id) {
      const messageId = sent.messageIds?.[0]?.messageId ?? newId("msg");
      await db()`INSERT INTO thread_messages (id, thread_id, sender, text, text_en, lang, order_id)
        VALUES (${messageId}, ${order.thread_id}, 'system', ${text}, ${text}, 'en', ${order.id}) ON CONFLICT DO NOTHING`;
    }
    return true;
  } catch (err) {
    console.error("Order notification failed:", err instanceof Error ? err.message : err);
    return false;
  }
}
