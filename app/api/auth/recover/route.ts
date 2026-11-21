import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { clientIp, isLimited, recordEvent } from "@/lib/rate-limit";
import { hashPasscode, slugify, verifyPasscode } from "@/lib/v2/crypto";
import { DUMMY_HASH, issueRecoveryCode, normalizeRecoveryCode } from "@/lib/v2/recovery";
import { setStaffCookie } from "@/lib/v2/session";

const PER_IP_FAILURES = 8;
const WINDOW_MINUTES = 15;
const GENERIC_ERROR = "The shop, name or recovery code is incorrect.";

// Owner passcode reset with the one-time recovery code. Every kind of mismatch returns the same error.
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const shop = typeof body?.shop === "string" ? body.shop.trim().slice(0, 80) : "";
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 60) : "";
  const code = typeof body?.recoveryCode === "string" ? normalizeRecoveryCode(body.recoveryCode.slice(0, 60)) : "";
  const newPasscode = typeof body?.newPasscode === "string" ? body.newPasscode : "";
  if (!shop || !name || !code) return NextResponse.json({ error: "Enter the shop name, your name and your recovery code." }, { status: 400 });
  if (newPasscode.length < 8) return NextResponse.json({ error: "Choose a new passcode of at least 8 characters." }, { status: 400 });

  const ipKey = `v2-recover-fail:${clientIp(req.headers)}`;
  if (await isLimited(ipKey, PER_IP_FAILURES, WINDOW_MINUTES)) {
    return NextResponse.json({ error: "Too many failed attempts. Try again in 15 minutes." }, { status: 429 });
  }

  const sql = db();
  const [row] = await sql`SELECT st.id, st.name, st.role, st.recovery_hash, s.slug, s.shop_name
    FROM staff st JOIN sellers s ON s.id = st.seller_id
    WHERE st.role = 'owner' AND (s.slug = ${slugify(shop)} OR lower(s.shop_name) = ${shop.toLowerCase()}) AND lower(st.name) = ${name.toLowerCase()}`;
  const ok = await verifyPasscode(code, row?.recovery_hash ?? DUMMY_HASH);
  if (!row || !row.recovery_hash || !ok) {
    await recordEvent(ipKey);
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
  }

  await sql`UPDATE staff SET passcode_hash = ${await hashPasscode(newPasscode)}, last_seen = now() WHERE id = ${row.id}`;
  const recoveryCode = await issueRecoveryCode(row.id);
  await setStaffCookie(row.id);
  return NextResponse.json({
    ok: true,
    seller: { slug: row.slug, name: row.shop_name },
    staff: { id: row.id, name: row.name, role: row.role },
    recoveryCode,
  });
}
