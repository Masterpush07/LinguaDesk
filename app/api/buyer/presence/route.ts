import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireBuyer } from "@/lib/v2/buyer-api";

// The chat page tells the server when the buyer has left (tab hidden or closed) or come back, so alerts are only sent to buyers who are away.
// It is called with navigator.sendBeacon when the page is going away, so it must be quick and must never fail loudly.
export async function POST(req: NextRequest) {
  const auth = await requireBuyer();
  if ("error" in auth) return auth.error;
  const body = (await req.json().catch(() => null)) as { state?: unknown } | null;
  if (body?.state === "away") {
    await db()`UPDATE buyers SET last_seen = NULL WHERE id = ${auth.buyerId}`.catch(() => undefined);
  } else if (body?.state === "here") {
    await db()`UPDATE buyers SET last_seen = now() WHERE id = ${auth.buyerId}`.catch(() => undefined);
  } else {
    return NextResponse.json({ error: "State must be here or away." }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
