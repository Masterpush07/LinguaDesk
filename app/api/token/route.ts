import { randomBytes } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { issueAccessToken } from "@/lib/nexconn-server";
import { legacyEnabled, legacyOff } from "@/lib/legacy";
import { clientIp, isLimited, recordEvent } from "@/lib/rate-limit";

// Generous on purpose: a classroom or office can share one public address. It only stops one source from minting thousands of users.
const SESSIONS_PER_HOUR_PER_IP = 60;

// Creates a guest identity and returns its Nexconn token to the browser.
export async function POST(req: NextRequest) {
  if (!legacyEnabled()) return legacyOff();
  const key = `guest:${clientIp(req.headers)}`;
  if (await isLimited(key, SESSIONS_PER_HOUR_PER_IP, 60)) {
    return NextResponse.json({ error: "Too many new chats from this network. Please try again later." }, { status: 429 });
  }
  await recordEvent(key);

  // The server picks the ID so a client can never ask for a token as someone else.
  const userId = "g" + randomBytes(10).toString("hex"); // letters + digits only, as the API requires
  try {
    const { accessToken } = await issueAccessToken(userId, "Guest");
    return NextResponse.json({ userId, token: accessToken });
  } catch (err) {
    console.error("token issue failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Could not create chat session" }, { status: 502 });
  }
}
