import { randomBytes } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { issueAccessToken } from "@/lib/nexconn-server";
import { clientIp, isLimited, recordEvent } from "@/lib/rate-limit";
import { currentBuyerId, setBuyerCookie } from "@/lib/v2/session";

const NEW_BUYERS_PER_HOUR_PER_IP = 60;

// Gives a visitor a chat identity without sign-up. A returning visitor keeps the same identity through the signed cookie.
export async function POST(req: NextRequest) {
  let buyerId = await currentBuyerId();
  if (!buyerId) {
    const key = `guest:${clientIp(req.headers)}`;
    if (await isLimited(key, NEW_BUYERS_PER_HOUR_PER_IP, 60)) {
      return NextResponse.json({ error: "Too many new visitors from this network. Please try again later." }, { status: 429 });
    }
    await recordEvent(key);
    buyerId = "g" + randomBytes(10).toString("hex");
  }
  try {
    const { accessToken } = await issueAccessToken(buyerId, "Guest");
    await db()`INSERT INTO buyers (id) VALUES (${buyerId}) ON CONFLICT DO NOTHING`;
    await setBuyerCookie(buyerId);
    return NextResponse.json({ userId: buyerId, token: accessToken });
  } catch (err) {
    console.error("buyer session failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Could not start the conversation. Please try again." }, { status: 502 });
  }
}
