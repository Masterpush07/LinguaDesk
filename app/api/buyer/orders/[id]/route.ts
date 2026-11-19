import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { notFound, requireBuyer, toBuyerOrder } from "@/lib/v2/buyer-api";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireBuyer();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const [row] = await db()`SELECT o.id, o.thread_id, o.status, o.total, o.created_at, o.confirmed_at, o.courier, o.tracking, o.card, s.slug, s.shop_name
    FROM orders_v2 o JOIN sellers s ON s.id = o.seller_id
    WHERE o.id = ${id} AND o.buyer_id = ${auth.buyerId}`;
  if (!row) return notFound("Order");
  return NextResponse.json(toBuyerOrder(row));
}
