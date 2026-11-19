import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/v2/guard";
import { buyerLabel, iso8601 } from "@/lib/v2/desk-threads";
import type { DeskCustomer, ThreadStatus } from "@/lib/v2/desk-types";

// Buyers who have a conversation with this shop, with their order history.
export async function GET(req: NextRequest) {
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;
  const { sellerId } = auth.staff;
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 80).replace(/[\\%_]/g, (c) => `\\${c}`);
  const rows = await db()`SELECT b.id, b.name, COALESCE(t.language, b.language) AS language, t.id AS thread_id, t.last_at, t.status,
      (SELECT count(*) FROM orders_v2 o WHERE o.seller_id = ${sellerId} AND o.buyer_id = b.id)::int AS orders,
      (SELECT COALESCE(sum(o.total), 0) FROM orders_v2 o WHERE o.seller_id = ${sellerId} AND o.buyer_id = b.id
        AND o.status IN ('confirmed', 'packed', 'shipped', 'delivered'))::int AS spent
    FROM threads t JOIN buyers b ON b.id = t.buyer_id
    WHERE t.seller_id = ${sellerId}
      AND (${q}::text = '' OR b.name ILIKE '%' || ${q}::text || '%' OR right(b.id, 6) ILIKE '%' || ${q}::text || '%'
        OR COALESCE(t.language, b.language, '') ILIKE '%' || ${q}::text || '%')
    ORDER BY t.last_at DESC LIMIT 200`;
  const customers: DeskCustomer[] = rows.map((r) => ({
    id: r.id,
    threadId: r.thread_id,
    label: buyerLabel(r.id, r.name),
    language: r.language,
    threads: 1,
    orders: r.orders,
    spentUsd: r.spent,
    lastAt: iso8601(r.last_at),
    lastStatus: r.status as ThreadStatus,
  }));
  return NextResponse.json(customers);
}
