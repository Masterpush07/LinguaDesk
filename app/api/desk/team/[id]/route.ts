import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/v2/guard";
import { Check, fail, invalidBody, readJson } from "@/lib/v2/seller-api";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const auth = await requireStaff({ owner: true });
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const body = await readJson(req);
  if (!body) return invalidBody();

  const sql = db();
  const [member] = await sql`SELECT id, role, languages, skills, max_concurrent FROM staff WHERE id = ${id} AND seller_id = ${auth.staff.sellerId}`;
  if (!member) return fail("Team member not found.", 404);

  if ("role" in body) {
    if (body.role !== "agent") return fail("Only the agent role can be assigned.");
    if (member.role === "owner") return fail("The shop owner cannot be changed to an agent.", 409);
  }
  const check = new Check();
  const languages = "languages" in body ? check.languages(body.languages, "Languages", false) : (member.languages as string[]);
  const skills = "skills" in body ? check.words(body.skills, "Skills", 10, 40) : (member.skills as string[]);
  const maxConcurrent = "maxConcurrent" in body ? check.whole(body.maxConcurrent, "Capacity", 1, 20) : (member.max_concurrent as number);
  if (!check.ok) return check.response;

  await sql`UPDATE staff SET languages = ${languages}, skills = ${skills}, max_concurrent = ${maxConcurrent}
    WHERE id = ${id} AND seller_id = ${auth.staff.sellerId}`;
  return NextResponse.json({ id, languages, skills, maxConcurrent });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const auth = await requireStaff({ owner: true });
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const sql = db();
  const [member] = await sql`SELECT id, role, name FROM staff WHERE id = ${id} AND seller_id = ${auth.staff.sellerId}`;
  if (!member) return fail("Team member not found.", 404);
  if (member.role === "owner") return fail("The shop owner cannot be removed.", 409);

  // Their open conversations go back to the queue instead of staying assigned to someone who can no longer answer.
  const released = await sql`UPDATE threads SET status = 'waiting', assigned_staff_id = NULL
    WHERE seller_id = ${auth.staff.sellerId} AND assigned_staff_id = ${id} RETURNING id`;
  for (const t of released) {
    await sql`INSERT INTO thread_events (thread_id, type, actor, payload)
      VALUES (${t.id}, 'unassigned', ${auth.staff.id}, ${JSON.stringify({ reason: "member_removed", name: member.name })}::jsonb)`;
  }
  await sql`DELETE FROM staff WHERE id = ${id} AND seller_id = ${auth.staff.sellerId}`;
  return NextResponse.json({ ok: true, releasedThreads: released.length });
}
