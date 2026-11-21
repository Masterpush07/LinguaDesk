import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { isLimited, recordEvent } from "@/lib/rate-limit";
import { requireBuyer } from "@/lib/v2/buyer-api";
import { newId } from "@/lib/v2/crypto";
import { requestOrigin } from "@/lib/v2/origin";

const MINUTES = 15;

// Creates a one-time link that opens this buyer's conversations on another device.
export async function POST(req: NextRequest) {
  const auth = await requireBuyer();
  if ("error" in auth) return auth.error;

  const key = `device-link:${auth.buyerId}`;
  if (await isLimited(key, 5, 60)) return NextResponse.json({ error: "Too many links created. Try again in a while." }, { status: 429 });
  await recordEvent(key);

  const id = newId("lnk");
  const [row] = await db()`INSERT INTO device_links (id, buyer_id, expires_at)
    VALUES (${id}, ${auth.buyerId}, now() + make_interval(mins => ${MINUTES})) RETURNING expires_at`;
  return NextResponse.json({ url: `${requestOrigin(req)}/continue/${id}`, expiresAt: new Date(row.expires_at as string | Date).toISOString() });
}
