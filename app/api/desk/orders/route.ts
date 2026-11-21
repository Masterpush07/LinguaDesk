import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/v2/guard";
import { fail } from "@/lib/v2/seller-api";
import { orderDto } from "@/lib/v2/seller-orders";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/v2/seller-types";

export async function GET(req: NextRequest) {
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;
  const status = req.nextUrl.searchParams.get("status");
  if (status && !ORDER_STATUSES.includes(status as OrderStatus)) return fail(`Status must be one of: ${ORDER_STATUSES.join(", ")}.`);
  const rows = await db()`SELECT id, status, total, card, courier, tracking, created_at, confirmed_at, buyer_id, thread_id, delivery, paid_at
    FROM orders_v2 WHERE seller_id = ${auth.staff.sellerId} AND (${status}::text IS NULL OR status = ${status})
    ORDER BY created_at DESC LIMIT 500`;
  return NextResponse.json(rows.map(orderDto));
}
