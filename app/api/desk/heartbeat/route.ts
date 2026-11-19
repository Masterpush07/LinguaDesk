import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/v2/guard";

// Called every 30 seconds by an open desk. A team member counts as online for 90 seconds after the last call.
export async function POST() {
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;
  const [row] = await db()`UPDATE staff SET last_seen = now() WHERE id = ${auth.staff.id} RETURNING available`;
  return NextResponse.json({ ok: true, available: row?.available ?? true });
}
