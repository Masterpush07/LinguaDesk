import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/v2/guard";
import { fail, loadHead, loadTeam, readBody } from "@/lib/v2/desk-threads";
import { logEvent } from "@/lib/v2/threads";

const CHANGED = "This conversation was changed by someone else. Refresh and try again.";

// Moves a conversation to a team member. The owner may assign anything; an agent may only pass on their own conversations.
export async function POST(req: NextRequest) {
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;
  const { staff } = auth;
  const body = await readBody(req);
  const threadId = typeof body?.threadId === "string" ? body.threadId : "";
  const staffId = typeof body?.staffId === "string" ? body.staffId : "";
  const force = body?.force === true;
  if (!threadId || !staffId) return fail(400, "Choose a conversation and a team member.");

  const thread = await loadHead(staff, threadId);
  if (!thread) return fail(404, "Conversation not found.");
  const owner = staff.role === "owner";
  if (!owner && thread.assignedStaff?.id !== staff.id) return fail(403, "Only the shop owner or the current agent can assign this conversation.");
  if (thread.status === "resolved") return fail(409, "This conversation is resolved. Reopen it before assigning it.");

  const target = (await loadTeam(staff.sellerId)).find((m) => m.id === staffId);
  if (!target) return fail(400, "Choose a team member from your shop.");
  if (thread.assignedStaff?.id === target.id) return fail(409, `This conversation is already assigned to ${target.name}.`);
  const full = target.load >= target.maxConcurrent;
  if (full && !(owner && force)) {
    return fail(409, `${target.name} is at capacity (${target.load} of ${target.maxConcurrent}).${owner ? " Use force to assign anyway." : ""}`);
  }

  const done = await db()`UPDATE threads SET status = 'assigned', assigned_staff_id = ${target.id}
    WHERE id = ${threadId} AND status <> 'resolved' RETURNING id`;
  if (done.length === 0) return fail(409, CHANGED);
  const to = { id: target.id, name: target.name };
  if (thread.assignedStaff) await logEvent(threadId, "transferred", "staff", { staffId: staff.id, name: staff.name, from: thread.assignedStaff, to });
  else await logEvent(threadId, "assigned", "staff", { staffId: target.id, name: target.name, by: staff.name, forced: full });
  return NextResponse.json({ thread: await loadHead(staff, threadId) });
}
