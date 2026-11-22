import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { toBuyerOrder } from "@/lib/v2/buyer-api";
import { currentBuyerId } from "@/lib/v2/session";

// A visitor with no session has no orders, so this answers an empty list instead of an error.
export async function GET() {
  const buyerId = await currentBuyerId();
  if (!buyerId) return NextResponse.json([]);
  const rows = await db()`SELECT o.id, o.thread_id, o.status, o.total, o.created_at, o.confirmed_at, o.courier, o.tracking, o.card, s.slug, s.shop_name
    FROM orders_v2 o JOIN sellers s ON s.id = o.seller_id
    WHERE o.buyer_id = ${buyerId}
    ORDER BY o.created_at DESC
    LIMIT 200`;
  return NextResponse.json(rows.map(toBuyerOrder));
}
