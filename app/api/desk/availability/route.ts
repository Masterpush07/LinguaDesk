import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/v2/guard";
import { fail, readBody } from "@/lib/v2/desk-threads";

export async function GET() {
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;
  const [row] = await db()`SELECT available FROM staff WHERE id = ${auth.staff.id}`;
  return NextResponse.json({ available: row?.available ?? true });
}

// Away means dispatch skips this team member until they switch back.
export async function POST(req: NextRequest) {
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;
  const body = await readBody(req);
  if (typeof body?.available !== "boolean") return fail(400, "Send available as true or false.");
  const [row] = await db()`UPDATE staff SET available = ${body.available} WHERE id = ${auth.staff.id} RETURNING available`;
  return NextResponse.json({ available: row.available });
}
