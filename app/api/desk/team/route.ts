import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/v2/guard";
import { iso } from "@/lib/v2/seller-api";
import type { TeamMemberDto } from "@/lib/v2/seller-types";

export async function GET() {
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;
  // Online means the desk pinged within the last 90 seconds, the same window dispatch uses.
  const rows = await db()`SELECT st.id, st.name, st.role, st.languages, st.skills, st.max_concurrent, st.available, st.last_seen,
      (st.last_seen IS NOT NULL AND st.last_seen > now() - interval '90 seconds') AS online,
      (SELECT count(*) FROM threads t WHERE t.assigned_staff_id = st.id AND t.status = 'assigned')::int AS active_threads
    FROM staff st WHERE st.seller_id = ${auth.staff.sellerId}
    ORDER BY (st.role = 'owner') DESC, lower(st.name)`;
  return NextResponse.json(
    rows.map(
      (r): TeamMemberDto => ({
        id: r.id,
        name: r.name,
        role: r.role,
        languages: r.languages,
        skills: r.skills,
        maxConcurrent: r.max_concurrent,
        available: r.available,
        online: r.online,
        lastSeen: iso(r.last_seen),
        activeThreads: r.active_threads,
      }),
    ),
  );
}
