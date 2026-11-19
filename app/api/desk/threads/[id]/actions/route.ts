import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/v2/guard";
import { dispatch, logEvent } from "@/lib/v2/threads";
import { canWork, fail, loadHead, loadTeam, NOT_YOURS, readBody } from "@/lib/v2/desk-threads";
import { languageCode } from "@/lib/v2/desk-translate";

type Ctx = { params: Promise<{ id: string }> };

const ACTIONS = ["claim", "transfer", "escalate", "resolve", "reopen", "handback"] as const;
type Action = (typeof ACTIONS)[number];

const CHANGED = "This conversation was changed by someone else. Refresh and try again.";

// Claim, transfer, escalate, resolve, reopen or hand back a conversation. Returns the refreshed thread.
export async function POST(req: NextRequest, ctx: Ctx) {
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;
  const { staff } = auth;
  const { id } = await ctx.params;
  const body = await readBody(req);
  const action = body?.action as Action | undefined;
  if (!action || !ACTIONS.includes(action)) return fail(400, "Unknown action.");

  const thread = await loadHead(staff, id);
  if (!thread) return fail(404, "Conversation not found.");

  const sql = db();
  const actor = { staffId: staff.id, name: staff.name };
  const resolved = thread.status === "resolved";

  if (action === "claim") {
    if (resolved) return fail(409, "This conversation is resolved. Reopen it before claiming it.");
    if (thread.assignedStaff?.id === staff.id) return fail(409, "This conversation is already assigned to you.");
    if (thread.assignedStaff && staff.role !== "owner") return fail(409, `This conversation is already assigned to ${thread.assignedStaff.name}.`);
    const done = await sql`UPDATE threads SET status = 'assigned', assigned_staff_id = ${staff.id}
      WHERE id = ${id} AND status <> 'resolved' RETURNING id`;
    if (done.length === 0) return fail(409, CHANGED);
    await logEvent(id, "claimed", "staff", { ...actor, from: thread.assignedStaff });
  } else if (action === "transfer") {
    if (resolved) return fail(409, "This conversation is resolved. Reopen it before transferring it.");
    if (staff.role !== "owner" && thread.assignedStaff?.id !== staff.id) return fail(403, NOT_YOURS);
    const staffId = typeof body?.staffId === "string" ? body.staffId : "";
    const target = (await loadTeam(staff.sellerId)).find((m) => m.id === staffId);
    if (!target) return fail(400, "Choose a team member from your shop.");
    if (thread.assignedStaff?.id === target.id) return fail(409, `This conversation is already assigned to ${target.name}.`);
    if (staff.role !== "owner" && target.load >= target.maxConcurrent) return fail(409, `${target.name} is at capacity (${target.load} of ${target.maxConcurrent}).`);
    const done = await sql`UPDATE threads SET status = 'assigned', assigned_staff_id = ${target.id}
      WHERE id = ${id} AND status <> 'resolved' RETURNING id`;
    if (done.length === 0) return fail(409, CHANGED);
    await logEvent(id, "transferred", "staff", { ...actor, from: thread.assignedStaff, to: { id: target.id, name: target.name } });
  } else if (action === "escalate") {
    if (resolved) return fail(409, "This conversation is resolved, so it cannot be escalated.");
    if (thread.priority === "critical") return fail(409, "This conversation is already Critical.");
    await sql`UPDATE threads SET priority = 'critical' WHERE id = ${id}`;
    await logEvent(id, "escalated", "staff", { ...actor, from: thread.priority });
  } else if (action === "resolve") {
    if (resolved) return fail(409, "This conversation is already resolved.");
    if (!canWork(staff, thread)) return fail(403, NOT_YOURS);
    await sql`UPDATE threads SET status = 'resolved', resolved_at = now() WHERE id = ${id}`;
    await logEvent(id, "resolved", "staff", actor);
  } else if (action === "reopen") {
    if (!resolved) return fail(409, "Only a resolved conversation can be reopened.");
    if (!canWork(staff, thread)) return fail(403, NOT_YOURS);
    const [seller] = await sql`SELECT response_target_min FROM sellers WHERE id = ${staff.sellerId}`;
    const done = await sql`UPDATE threads SET status = 'waiting', assigned_staff_id = NULL, resolved_at = NULL, handoff_at = now(),
        sla_due_at = now() + make_interval(mins => ${seller.response_target_min}), first_response_at = NULL
      WHERE id = ${id} AND status = 'resolved' RETURNING id`;
    if (done.length === 0) return fail(409, CHANGED);
    await logEvent(id, "reopened", "staff", actor);
    await dispatch(id, staff.sellerId, languageCode(thread.language));
  } else {
    if (thread.status !== "assigned" && thread.status !== "waiting") return fail(409, "Only a conversation waiting for an agent or with an agent can be handed back to the AI.");
    if (!canWork(staff, thread)) return fail(403, NOT_YOURS);
    const done = await sql`UPDATE threads SET status = 'ai', assigned_staff_id = NULL
      WHERE id = ${id} AND status IN ('assigned', 'waiting') RETURNING id`;
    if (done.length === 0) return fail(409, CHANGED);
    await logEvent(id, "handed_back", "staff", actor);
  }

  return NextResponse.json({ thread: await loadHead(staff, id) });
}
