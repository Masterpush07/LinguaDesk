import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { clientIp, isLimited, recordEvent } from "@/lib/rate-limit";
import { slugify, verifyPasscode } from "@/lib/v2/crypto";
import { setStaffCookie } from "@/lib/v2/session";

const PER_IP_FAILURES = 8;
const WINDOW_MINUTES = 15;
// Compared against when the account does not exist, so a missing account takes about as long as a wrong passcode.
const DUMMY_HASH = "00000000000000000000000000000000:0000000000000000000000000000000000000000000000000000000000000000";

// Staff sign-in: shop name, own name and passcode. The same error is returned for every kind of mismatch.
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const shop = typeof body?.shop === "string" ? body.shop.trim().slice(0, 80) : "";
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 60) : "";
  const passcode = typeof body?.passcode === "string" ? body.passcode : "";
  if (!shop || !name || !passcode) return NextResponse.json({ error: "Enter the shop name, your name and your passcode." }, { status: 400 });

  const ipKey = `v2-login-fail:${clientIp(req.headers)}`;
  if (await isLimited(ipKey, PER_IP_FAILURES, WINDOW_MINUTES)) {
    return NextResponse.json({ error: "Too many failed attempts. Try again in 15 minutes." }, { status: 429 });
  }

  const [row] = await db()`SELECT st.id, st.name, st.role, st.passcode_hash, s.slug, s.shop_name
    FROM staff st JOIN sellers s ON s.id = st.seller_id
    WHERE (s.slug = ${slugify(shop)} OR lower(s.shop_name) = ${shop.toLowerCase()}) AND lower(st.name) = ${name.toLowerCase()}`;
  const ok = await verifyPasscode(passcode, row?.passcode_hash ?? DUMMY_HASH);
  if (!row || !ok) {
    await recordEvent(ipKey);
    return NextResponse.json({ error: "The shop, name or passcode is incorrect." }, { status: 401 });
  }

  await db()`UPDATE staff SET last_seen = now() WHERE id = ${row.id}`;
  await setStaffCookie(row.id);
  return NextResponse.json({ ok: true, seller: { slug: row.slug, name: row.shop_name }, staff: { id: row.id, name: row.name, role: row.role } });
}
