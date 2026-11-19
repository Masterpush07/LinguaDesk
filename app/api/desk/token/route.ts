import { NextResponse } from "next/server";
import { issueAccessToken } from "@/lib/nexconn-server";
import { requireStaff } from "@/lib/v2/guard";

// Lets a signed-in desk connect to Nexconn as the shop's chat identity, so new buyer messages show up live.
export async function POST() {
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;
  try {
    const { accessToken } = await issueAccessToken(auth.staff.nexconnUserId, auth.staff.sellerName);
    return NextResponse.json({ userId: auth.staff.nexconnUserId, token: accessToken });
  } catch (err) {
    console.error("desk token failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Could not connect to live chat." }, { status: 502 });
  }
}
