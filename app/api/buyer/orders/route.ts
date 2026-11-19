import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireBuyer, toBuyerOrder } from "@/lib/v2/buyer-api";

export async function GET() {
  const auth = await requireBuyer();
  if ("error" in auth) return auth.error;
  const rows = await db()`SELECT o.id, o.thread_id, o.status, o.total, o.created_at, o.confirmed_at, o.courier, o.tracking, o.card, s.slug, s.shop_name
    FROM orders_v2 o JOIN sellers s ON s.id = o.seller_id
    WHERE o.buyer_id = ${auth.buyerId}
    ORDER BY o.created_at DESC
    LIMIT 200`;
  return NextResponse.json(rows.map(toBuyerOrder));
}
