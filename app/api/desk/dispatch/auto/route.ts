import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/v2/guard";
import { dispatch } from "@/lib/v2/threads";
import { languageCode } from "@/lib/v2/desk-translate";

// Runs the normal dispatcher for every waiting, unassigned conversation, oldest SLA first.
export async function POST() {
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;
  const { sellerId } = auth.staff;
  const waiting = await db()`SELECT id, language FROM threads WHERE seller_id = ${sellerId} AND status = 'waiting' AND assigned_staff_id IS NULL
    ORDER BY CASE priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 ELSE 2 END, sla_due_at NULLS LAST, last_at LIMIT 100`;
  let assigned = 0;
  for (const t of waiting) {
    if (await dispatch(t.id, sellerId, languageCode(t.language))) assigned += 1;
  }
  return NextResponse.json({ assigned, remaining: waiting.length - assigned });
}
