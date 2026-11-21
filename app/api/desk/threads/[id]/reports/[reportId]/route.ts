import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/v2/guard";
import { fail, loadHead, readBody } from "@/lib/v2/desk-threads";
import { logEvent } from "@/lib/v2/threads";

type Ctx = { params: Promise<{ id: string; reportId: string }> };

// The team marks a translation report as looked at (or reopens it). Reports are never deleted, so the history stays honest.
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;
  const { staff } = auth;
  const { id, reportId } = await ctx.params;
  const body = await readBody(req);
  if (body?.status !== "reviewed" && body?.status !== "open") return fail(400, "The status must be reviewed or open.");
  if (!(await loadHead(staff, id))) return fail(404, "Conversation not found.");

  const status = body.status;
  const rows = await db()`UPDATE translation_reports SET status = ${status}, reviewed_at = CASE WHEN ${status} = 'reviewed' THEN now() ELSE NULL END
    WHERE id = ${reportId} AND thread_id = ${id} AND seller_id = ${staff.sellerId} AND status <> ${status} RETURNING id`;
  if (rows.length === 0) {
    const [existing] = await db()`SELECT status FROM translation_reports WHERE id = ${reportId} AND thread_id = ${id} AND seller_id = ${staff.sellerId}`;
    if (!existing) return fail(404, "Report not found.");
    return NextResponse.json({ ok: true, status: existing.status });
  }
  if (status === "reviewed") await logEvent(id, "translation_reviewed", staff.id, { reportId, name: staff.name }).catch(() => undefined);
  return NextResponse.json({ ok: true, status });
}
