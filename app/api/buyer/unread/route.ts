import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { currentBuyerId } from "@/lib/v2/session";

// How many messages from shops the visitor has not read, across all conversations, for the badge in the header.
// A visitor with no conversations (or no session) simply has none; this never answers 401, so ordinary pages do not log errors.
export async function GET() {
  const buyerId = await currentBuyerId();
  if (!buyerId) return NextResponse.json({ count: 0 });
  const [row] = await db()`SELECT count(*)::int AS n FROM thread_messages m JOIN threads t ON t.id = m.thread_id
    WHERE t.buyer_id = ${buyerId} AND m.sender IN ('staff', 'ai') AND m.created_at > t.buyer_read_at`;
  return NextResponse.json({ count: row?.n ?? 0 }, { headers: { "Cache-Control": "no-store" } });
}
