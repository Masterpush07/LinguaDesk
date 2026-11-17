import { createHash, timingSafeEqual } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { issueAccessToken } from "@/lib/nexconn-server";
import { setOwnerCookie } from "@/lib/owner-auth";
import { SHOP_ID, SHOP_NAME } from "@/lib/shop";

// Hashing first gives both sides equal length, which timingSafeEqual requires.
const digest = (value: string) => createHash("sha256").update(value).digest();

// Gives the shop owner a token for the shop's chat identity, guarded by a passcode.
export async function POST(req: NextRequest) {
  const expected = process.env.OWNER_PASSCODE;
  if (!expected) {
    console.error("OWNER_PASSCODE is not set");
    return NextResponse.json({ error: "Owner login is not configured" }, { status: 500 });
  }

  const body = (await req.json().catch(() => null)) as { passcode?: unknown } | null;
  const passcode = typeof body?.passcode === "string" ? body.passcode : "";
  if (!timingSafeEqual(digest(passcode), digest(expected))) {
    return NextResponse.json({ error: "Wrong passcode" }, { status: 401 });
  }

  try {
    const { accessToken } = await issueAccessToken(SHOP_ID, SHOP_NAME);
    await setOwnerCookie();
    return NextResponse.json({ userId: SHOP_ID, token: accessToken });
  } catch (err) {
    console.error("owner token issue failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Could not start owner session" }, { status: 502 });
  }
}
