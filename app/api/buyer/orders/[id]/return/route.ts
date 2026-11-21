import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { addSystemMessage, notFound, requireBuyer } from "@/lib/v2/buyer-api";
import { RETURN_REASONS, RETURN_WINDOW_DAYS } from "@/lib/v2/buyer-types";
import { newId } from "@/lib/v2/crypto";
import { notifyShop } from "@/lib/v2/notifications";
import { Check, fail, invalidBody, readJson } from "@/lib/v2/seller-api";

const REASON_LABEL: Record<(typeof RETURN_REASONS)[number], string> = {
  damaged: "Item arrived damaged",
  wrong_item: "Wrong item received",
  not_as_described: "Not as described",
  changed_mind: "Changed my mind",
  other: "Other reason",
};

// A delivered order can have one return request that is not rejected. The insert re-checks that rule in the same statement, so two taps create one request.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireBuyer();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const body = await readJson(req);
  if (!body) return invalidBody();
  const check = new Check();
  const reason = check.oneOf(body.reason, "Reason", RETURN_REASONS);
  const details = check.text(body.details, "Details", 500);
  const photoAssetId = typeof body.photoAssetId === "string" && body.photoAssetId ? body.photoAssetId : null;
  if (body.photoAssetId !== undefined && body.photoAssetId !== null && typeof body.photoAssetId !== "string") check.errors.push("The photo is not valid.");
  if (!check.ok) return check.response;

  const sql = db();
  const [order] = await sql`SELECT id, seller_id, thread_id, status, updated_at > now() - make_interval(days => ${RETURN_WINDOW_DAYS}) AS in_window
    FROM orders_v2 WHERE id = ${id} AND buyer_id = ${auth.buyerId}`;
  if (!order) return notFound("Order");
  if (order.status !== "delivered") return fail("A return can only be requested after the order is delivered.", 409);
  if (!order.in_window) return fail(`The ${RETURN_WINDOW_DAYS}-day return period for this order has ended. Contact the shop in the conversation.`, 409);

  if (photoAssetId) {
    const [asset] = await sql`SELECT id FROM assets WHERE id = ${photoAssetId} AND kind = 'return' AND buyer_id = ${auth.buyerId}
      AND (seller_id IS NULL OR seller_id = ${order.seller_id})`;
    if (!asset) return fail("The photo could not be used. Upload it again.", 400);
    // Return photos are private; linking the asset to the shop lets its team open the photo.
    await sql`UPDATE assets SET seller_id = ${order.seller_id} WHERE id = ${photoAssetId} AND seller_id IS NULL`;
  }

  const returnId = newId("ret");
  const created = await sql`INSERT INTO return_requests (id, order_id, seller_id, buyer_id, reason, details, photo_asset_id)
    SELECT ${returnId}, ${id}, ${order.seller_id}, ${auth.buyerId}, ${reason}, ${details}, ${photoAssetId}
    WHERE NOT EXISTS (SELECT 1 FROM return_requests r WHERE r.order_id = ${id} AND r.status <> 'rejected')
    RETURNING id`;
  if (created.length === 0) return fail("A return has already been requested for this order.", 409);

  let threadId: string | null = order.thread_id ?? null;
  if (!threadId) {
    const [t] = await sql`SELECT id FROM threads WHERE seller_id = ${order.seller_id} AND buyer_id = ${auth.buyerId}`;
    threadId = t?.id ?? null;
  }
  if (threadId) await addSystemMessage(threadId, `You requested a return for order ${id}.`);
  await notifyShop(order.seller_id, threadId, "return_requested", "A return was requested", `Order ${id}: ${REASON_LABEL[reason]}.${details ? ` ${details}` : ""}`);
  return NextResponse.json({ ok: true, id: returnId }, { status: 201 });
}
