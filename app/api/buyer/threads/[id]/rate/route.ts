import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { notFound, requireBuyer } from "@/lib/v2/buyer-api";
import { logEvent } from "@/lib/v2/threads";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireBuyer();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as { rating?: unknown } | null;
  const rating = body?.rating;
  if (typeof rating !== "number" || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "Choose a rating from 1 to 5" }, { status: 400 });
  }
  const sql = db();
  const rated = await sql`UPDATE threads SET rating = ${rating} WHERE id = ${id} AND buyer_id = ${auth.buyerId} AND status = 'resolved' RETURNING id`;
  if (rated.length === 0) {
    const [exists] = await sql`SELECT id FROM threads WHERE id = ${id} AND buyer_id = ${auth.buyerId}`;
    if (!exists) return notFound("Conversation");
    return NextResponse.json({ error: "You can rate a conversation once it has been resolved." }, { status: 409 });
  }
  await logEvent(id, "rated", "buyer", { rating });
  return NextResponse.json({ ok: true, rating });
}
