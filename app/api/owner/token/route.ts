import { createHash, timingSafeEqual } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { issueAccessToken } from "@/lib/nexconn-server";
import { legacyEnabled, legacyOff } from "@/lib/legacy";
import { setOwnerCookie } from "@/lib/owner-auth";
import { clientIp, isLimited, recordEvent } from "@/lib/rate-limit";
import { SHOP_ID, SHOP_NAME } from "@/lib/shop";

// Hashing first gives both sides equal length, which timingSafeEqual requires.
const digest = (value: string) => createHash("sha256").update(value).digest();

const PER_IP_FAILURES = 5; // wrong passcodes allowed per address
const GLOBAL_FAILURES = 40; // across all addresses, which stops a spread-out guessing attack
const WINDOW_MINUTES = 15;

// Gives the shop owner a token for the shop's chat identity, guarded by a passcode.
export async function POST(req: NextRequest) {
  if (!legacyEnabled()) return legacyOff();
  const expected = process.env.OWNER_PASSCODE;
  if (!expected) {
    console.error("OWNER_PASSCODE is not set");
    return NextResponse.json({ error: "Owner login is not configured" }, { status: 500 });
  }

  const ipKey = `login-fail:${clientIp(req.headers)}`;
  if ((await isLimited(ipKey, PER_IP_FAILURES, WINDOW_MINUTES, { failClosed: true })) || (await isLimited("login-fail:all", GLOBAL_FAILURES, WINDOW_MINUTES, { failClosed: true }))) {
    return NextResponse.json({ error: "Too many wrong attempts. Try again in 15 minutes." }, { status: 429 });
  }

  const body = (await req.json().catch(() => null)) as { passcode?: unknown } | null;
  const passcode = typeof body?.passcode === "string" ? body.passcode : "";
  if (!timingSafeEqual(digest(passcode), digest(expected))) {
    await Promise.all([recordEvent(ipKey), recordEvent("login-fail:all")]);
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
