import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/v2/guard";
import { RETURN_STATUSES, type ReturnStatus } from "@/lib/v2/returns-types";
import { returnDto } from "@/lib/v2/seller-returns";

// The shop's return requests, newest first, for any signed-in staff member of the shop.
export async function GET() {
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;
  const rows = await db()`SELECT r.id, r.order_id, r.buyer_id, r.reason, r.details, r.photo_asset_id, r.status, r.seller_note, r.created_at, r.updated_at, o.total
    FROM return_requests r JOIN orders_v2 o ON o.id = r.order_id
    WHERE r.seller_id = ${auth.staff.sellerId}
    ORDER BY r.created_at DESC LIMIT 500`;
  const returns = rows.map(returnDto);
  const counts = Object.fromEntries(RETURN_STATUSES.map((s) => [s, returns.filter((r) => r.status === s).length])) as Record<ReturnStatus, number>;
  return NextResponse.json({ returns, counts });
}
