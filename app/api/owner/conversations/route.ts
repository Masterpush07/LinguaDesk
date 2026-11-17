import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isOwner } from "@/lib/owner-auth";

// Inbox for the owner: customers who need a person come first, then the most recent chats.
export async function GET() {
  if (!(await isOwner())) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const rows = await db()`SELECT customer_id, status, language, summary, last_text, last_at
    FROM conversations ORDER BY (status = 'waiting') DESC, last_at DESC LIMIT 100`;
  return NextResponse.json(rows);
}
