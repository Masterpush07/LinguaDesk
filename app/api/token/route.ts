import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { issueAccessToken } from "@/lib/nexconn-server";

// Creates a guest identity and returns its Nexconn token to the browser.
export async function POST() {
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
