import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { addSystemMessage, notFound, requireBuyer } from "@/lib/v2/buyer-api";
import { notifyShop } from "@/lib/v2/notifications";
import { Check, readJson } from "@/lib/v2/seller-api";

const TOO_LATE = "This order can no longer be cancelled. Contact the shop in the conversation.";

// The buyer cancels an order that has not been packed yet. One conditional UPDATE decides who wins, so a second tap never notifies twice.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireBuyer();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const body = (await readJson(req)) ?? {};
  const check = new Check();
  const reason = check.text(body.reason, "Reason", 200);
  if (!check.ok) return check.response;

  const sql = db();
  const claimed = await sql`UPDATE orders_v2 SET status = 'cancelled', cancel_reason = ${reason || null}, cancelled_at = now(), updated_at = now()
    WHERE id = ${id} AND buyer_id = ${auth.buyerId} AND status IN ('proposed', 'confirmed')
    RETURNING id, seller_id, thread_id`;
  if (claimed.length === 0) {
    const [existing] = await sql`SELECT status FROM orders_v2 WHERE id = ${id} AND buyer_id = ${auth.buyerId}`;
    if (!existing) return notFound("Order");
    if (existing.status === "cancelled") return NextResponse.json({ error: "This order is already cancelled." }, { status: 409 });
    return NextResponse.json({ error: TOO_LATE }, { status: 409 });
  }

  const { seller_id: sellerId, thread_id: orderThread } = claimed[0];
  let threadId: string | null = orderThread ?? null;
  if (!threadId) {
    const [t] = await sql`SELECT id FROM threads WHERE seller_id = ${sellerId} AND buyer_id = ${auth.buyerId}`;
    threadId = t?.id ?? null;
  }
  if (threadId) await addSystemMessage(threadId, `You cancelled order ${id}.`);
  await notifyShop(sellerId, threadId, "order_cancelled", "An order was cancelled", reason ? `Order ${id} was cancelled by the buyer. Reason: ${reason}` : `Order ${id} was cancelled by the buyer.`);
  return NextResponse.json({ ok: true });
}
