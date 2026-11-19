import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/v2/guard";
import { listThreads, loadTeam, ONLINE_SECONDS, toSummary } from "@/lib/v2/desk-threads";
import type { DispatchData } from "@/lib/v2/desk-types";

const CAP = 50;

// Supervisor view of the shop's queue: counts, three columns of conversations and the team roster.
export async function GET() {
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;
  const { staff } = auth;
  const [unassigned, assigned, resolved, roster, [stats]] = await Promise.all([
    listThreads(staff, { bucket: "unassigned", limit: CAP }),
    listThreads(staff, { bucket: "assigned", limit: CAP }),
    listThreads(staff, { bucket: "resolved", limit: CAP }),
    loadTeam(staff.sellerId),
    db()`SELECT
        (SELECT count(*) FROM threads WHERE seller_id = ${staff.sellerId} AND status = 'waiting')::int AS waiting,
        (SELECT count(*) FROM threads WHERE seller_id = ${staff.sellerId} AND status = 'waiting' AND assigned_staff_id IS NULL)::int AS unassigned,
        (SELECT count(*) FROM threads WHERE seller_id = ${staff.sellerId} AND status IN ('waiting', 'assigned')
          AND first_response_at IS NULL AND sla_due_at < now())::int AS breached,
        (SELECT count(*) FROM threads WHERE seller_id = ${staff.sellerId} AND status = 'resolved' AND resolved_at >= date_trunc('day', now()))::int AS resolved_today,
        (SELECT count(*) FROM staff WHERE seller_id = ${staff.sellerId} AND available
          AND last_seen > now() - make_interval(secs => ${ONLINE_SECONDS}))::int AS online_staff`,
  ]);
  const body: DispatchData = {
    stats: { waiting: stats.waiting, unassigned: stats.unassigned, breached: stats.breached, resolvedToday: stats.resolved_today, onlineStaff: stats.online_staff },
    columns: { unassigned: unassigned.map(toSummary), assigned: assigned.map(toSummary), resolved: resolved.map(toSummary) },
    roster,
  };
  return NextResponse.json(body);
}
