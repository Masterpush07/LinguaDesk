import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { newId } from "@/lib/v2/crypto";
import { requireStaff } from "@/lib/v2/guard";
import { fail, iso8601, loadHead, readBody } from "@/lib/v2/desk-threads";
import { logEvent } from "@/lib/v2/threads";

type Ctx = { params: Promise<{ id: string }> };

// Internal note: visible to the team only, never sent to the buyer.
export async function POST(req: NextRequest, ctx: Ctx) {
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;
  const { staff } = auth;
  const { id } = await ctx.params;
  const body = await readBody(req);
  const text = typeof body?.text === "string" ? body.text.trim().slice(0, 2000) : "";
  if (!text) return fail(400, "Write the note first.");
  if (!(await loadHead(staff, id))) return fail(404, "Conversation not found.");

  const noteId = newId("note");
  const [row] = await db()`INSERT INTO thread_notes (id, thread_id, staff_id, text) VALUES (${noteId}, ${id}, ${staff.id}, ${text}) RETURNING created_at`;
  await logEvent(id, "note_added", "staff", { staffId: staff.id, name: staff.name });
  return NextResponse.json({ note: { id: noteId, text, staffName: staff.name, createdAt: iso8601(row.created_at) } }, { status: 201 });
}
