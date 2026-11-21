import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { iso, notFound, requireBuyer, toBuyerOrder } from "@/lib/v2/buyer-api";
import { RETURN_WINDOW_DAYS, type ReturnReason, type ReturnStatus } from "@/lib/v2/buyer-types";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireBuyer();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const sql = db();
  const [[row], [ret], [rev]] = await Promise.all([
    sql`SELECT o.id, o.thread_id, o.status, o.total, o.created_at, o.confirmed_at, o.courier, o.tracking, o.card, o.cancel_reason, o.cancelled_at,
        o.status = 'delivered' AND o.updated_at > now() - make_interval(days => ${RETURN_WINDOW_DAYS}) AS in_window, s.slug, s.shop_name
      FROM orders_v2 o JOIN sellers s ON s.id = o.seller_id
      WHERE o.id = ${id} AND o.buyer_id = ${auth.buyerId}`,
    sql`SELECT id, status, reason, details, photo_asset_id, seller_note, created_at FROM return_requests
      WHERE order_id = ${id} AND buyer_id = ${auth.buyerId} ORDER BY created_at DESC LIMIT 1`,
    sql`SELECT rating, body, created_at FROM reviews WHERE order_id = ${id} AND buyer_id = ${auth.buyerId}`,
  ]);
  if (!row) return notFound("Order");

  const order = toBuyerOrder(row);
  if (ret) {
    order.returnRequest = {
      id: ret.id,
      status: ret.status as ReturnStatus,
      reason: ret.reason as ReturnReason,
      details: ret.details,
      photoUrl: ret.photo_asset_id ? `/api/assets/${ret.photo_asset_id}` : null,
      sellerNote: ret.seller_note,
      createdAt: iso(ret.created_at) as string,
    };
  }
  if (rev) order.review = { rating: rev.rating, body: rev.body, createdAt: iso(rev.created_at) as string };
  order.returnEligible = !!row.in_window && (!ret || ret.status === "rejected");
  return NextResponse.json(order);
}
