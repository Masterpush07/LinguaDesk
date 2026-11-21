import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { currentBuyerId, currentStaff } from "@/lib/v2/session";
import { fail, invalidBody, readJson } from "@/lib/v2/seller-api";

// Removes only the caller's own subscription for this browser address; anyone else's row is left alone.
export async function POST(req: NextRequest) {
  const body = await readJson(req);
  if (!body) return invalidBody();
  const endpoint = typeof body.endpoint === "string" ? body.endpoint : "";
  if (!endpoint || endpoint.length > 600) return fail("The endpoint is not valid.");

  const [staff, buyerId] = await Promise.all([currentStaff(), currentBuyerId()]);
  if (!staff && !buyerId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  await db()`DELETE FROM push_subscriptions WHERE endpoint = ${endpoint}
    AND ((audience = 'staff' AND staff_id = ${staff?.id ?? null}) OR (audience = 'buyer' AND buyer_id = ${buyerId}))`;
  return NextResponse.json({ ok: true });
}
