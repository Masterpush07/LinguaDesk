import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/v2/guard";
import { buyerLabel, iso, timeZoneFrom } from "@/lib/v2/seller-api";
import type { OverviewDto, ThreadPriority, ThreadStatus } from "@/lib/v2/seller-types";

export async function GET(req: NextRequest) {
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;
  const sellerId = auth.staff.sellerId;
  const tz = timeZoneFrom(req);
  const sql = db();

  const [[counts], [orders], lowStock, recent] = await Promise.all([
    sql`SELECT
      count(*) FILTER (WHERE status <> 'resolved')::int AS open_threads,
      count(*) FILTER (WHERE status = 'waiting')::int AS waiting,
      count(*)::int AS total,
      count(*) FILTER (WHERE handoff_at IS NULL)::int AS never_handed_off
      FROM threads WHERE seller_id = ${sellerId}`,
    sql`SELECT
      count(*) FILTER (WHERE created_at >= date_trunc('day', now() AT TIME ZONE ${tz}) AT TIME ZONE ${tz})::int AS today,
      count(*) FILTER (WHERE status IN ('confirmed', 'packed', 'shipped', 'delivered'))::int AS confirmed,
      count(*) FILTER (WHERE status IN ('confirmed', 'packed'))::int AS to_fulfil
      FROM orders_v2 WHERE seller_id = ${sellerId}`,
    sql`SELECT id, name, stock FROM products WHERE seller_id = ${sellerId} AND active AND stock <= 5 ORDER BY stock, name LIMIT 20`,
    sql`SELECT id, buyer_id, subject, status, priority, last_at FROM threads WHERE seller_id = ${sellerId} ORDER BY last_at DESC LIMIT 5`,
  ]);

  const dto: OverviewDto = {
    openThreads: counts.open_threads,
    waitingForAgent: counts.waiting,
    aiResolvedPercent: counts.total === 0 ? null : Math.round((counts.never_handed_off / counts.total) * 100),
    ordersToday: orders.today,
    confirmedOrders: orders.confirmed,
    ordersToFulfil: orders.to_fulfil,
    lowStock: lowStock.map((p) => ({ id: p.id, name: p.name, stock: p.stock })),
    recentThreads: recent.map((t) => ({
      id: t.id,
      buyerLabel: buyerLabel(t.buyer_id),
      subject: t.subject,
      status: t.status as ThreadStatus,
      priority: t.priority as ThreadPriority,
      lastAt: iso(t.last_at) ?? "",
    })),
  };
  return NextResponse.json(dto);
}
