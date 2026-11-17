import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { isOwner } from "@/lib/owner-auth";

const ID_PATTERN = /^[A-Za-z0-9]{3,64}$/; // same shape as Nexconn user IDs, so nothing odd reaches the query

type Ctx = { params: Promise<{ id: string }> };

// One conversation with its full message history.
export async function GET(_req: NextRequest, ctx: Ctx) {
  if (!(await isOwner())) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { id } = await ctx.params;
  if (!ID_PATTERN.test(id)) return NextResponse.json({ error: "Bad id" }, { status: 400 });

  const sql = db();
  const [conversation] = await sql`SELECT customer_id, status, language, summary, last_text, last_at
    FROM conversations WHERE customer_id = ${id}`;
  if (!conversation) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const messages = await sql`SELECT id, sender, text, text_en, created_at
    FROM messages WHERE customer_id = ${id} ORDER BY created_at LIMIT 500`;
  return NextResponse.json({ conversation, messages });
}

// Hands the chat back to the AI assistant.
export async function POST(_req: NextRequest, ctx: Ctx) {
  if (!(await isOwner())) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { id } = await ctx.params;
  if (!ID_PATTERN.test(id)) return NextResponse.json({ error: "Bad id" }, { status: 400 });
  await db()`UPDATE conversations SET status = 'ai', summary = NULL WHERE customer_id = ${id}`;
  return NextResponse.json({ ok: true });
}
