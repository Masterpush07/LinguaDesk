import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { addSystemMessage } from "@/lib/v2/buyer-api";
import { requireStaff } from "@/lib/v2/guard";
import { fail, invalidBody, readJson } from "@/lib/v2/seller-api";
import { logEvent } from "@/lib/v2/threads";

type Ctx = { params: Promise<{ id: string }> };

// The shop records that it has (or has not) received the buyer's payment. LinguaDesk never moves money; this only keeps the shop's own record.
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const auth = await requireStaff({ owner: true });
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const body = await readJson(req);
  if (!body) return invalidBody();
  if (typeof body.paid !== "boolean") return fail("Send paid as true or false.");

  const sql = db();
  const [order] = await sql`SELECT id, status, thread_id, paid_at FROM orders_v2 WHERE id = ${id} AND seller_id = ${auth.staff.sellerId}`;
  if (!order) return fail("Order not found.", 404);
  if (order.status === "proposed" || order.status === "cancelled") {
    return fail(order.status === "proposed" ? "The customer has not confirmed this order yet." : "A cancelled order cannot be marked as paid.", 409);
  }

  // The WHERE clause makes a double click harmless: only the first request changes anything.
  const [row] = body.paid
    ? await sql`UPDATE orders_v2 SET paid_at = now() WHERE id = ${id} AND seller_id = ${auth.staff.sellerId} AND paid_at IS NULL RETURNING paid_at`
    : await sql`UPDATE orders_v2 SET paid_at = NULL WHERE id = ${id} AND seller_id = ${auth.staff.sellerId} AND paid_at IS NOT NULL RETURNING id`;

  if (row && order.thread_id) {
    await logEvent(order.thread_id, body.paid ? "order_paid" : "order_unpaid", auth.staff.id, { orderId: id }).catch(() => undefined);
    if (body.paid) await addSystemMessage(order.thread_id, `The shop confirmed your payment for order ${id}. Thank you.`).catch(() => undefined);
  }
  const paidAt = body.paid ? (row?.paid_at ?? order.paid_at ?? null) : null;
  return NextResponse.json({ ok: true, paidAt: paidAt ? new Date(paidAt as string | Date).toISOString() : null });
}
