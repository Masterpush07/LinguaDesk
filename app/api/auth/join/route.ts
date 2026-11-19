import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { clientIp, isLimited, recordEvent } from "@/lib/rate-limit";
import { hashPasscode, newId } from "@/lib/v2/crypto";
import { setStaffCookie } from "@/lib/v2/session";

const LANG = /^[a-z]{2}$/;
const PER_IP_FAILURES = 8;

// An agent joins a shop's team with the one-time invite code the owner created.
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const code = typeof body?.inviteCode === "string" ? body.inviteCode.trim().toUpperCase().slice(0, 32) : "";
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 60) : "";
  const passcode = typeof body?.passcode === "string" ? body.passcode : "";
  const languages = Array.isArray(body?.languages)
    ? Array.from(new Set(["en", ...(body.languages as unknown[]).filter((l): l is string => typeof l === "string" && LANG.test(l))])).slice(0, 12)
    : ["en"];
  if (!code) return NextResponse.json({ error: "Enter the invite code from the shop owner." }, { status: 400 });
  if (name.length < 2) return NextResponse.json({ error: "Enter your name." }, { status: 400 });
  if (passcode.length < 8) return NextResponse.json({ error: "Choose a passcode of at least 8 characters." }, { status: 400 });

  const ipKey = `v2-join-fail:${clientIp(req.headers)}`;
  if (await isLimited(ipKey, PER_IP_FAILURES, 15)) return NextResponse.json({ error: "Too many attempts. Try again in 15 minutes." }, { status: 429 });

  const sql = db();
  const staffId = newId("stf");
  // Claiming the code and creating the account are one conditional statement, so a code works exactly once.
  const claimed = await sql`UPDATE invites SET used_at = now(), used_by = ${staffId}
    WHERE code = ${code} AND used_at IS NULL RETURNING seller_id, role`;
  if (claimed.length === 0) {
    await recordEvent(ipKey);
    return NextResponse.json({ error: "This invite code is not valid or has already been used." }, { status: 400 });
  }
  const { seller_id: sellerId, role } = claimed[0];
  const taken = await sql`SELECT 1 FROM staff WHERE seller_id = ${sellerId} AND lower(name) = ${name.toLowerCase()}`;
  if (taken.length > 0) {
    await sql`UPDATE invites SET used_at = NULL, used_by = NULL WHERE code = ${code}`;
    return NextResponse.json({ error: "A team member with that name already exists. Use a different name." }, { status: 409 });
  }
  await sql`INSERT INTO staff (id, seller_id, name, role, languages, passcode_hash, last_seen)
    VALUES (${staffId}, ${sellerId}, ${name}, ${role}, ${languages}, ${await hashPasscode(passcode)}, now())`;
  await setStaffCookie(staffId);
  return NextResponse.json({ ok: true, staff: { id: staffId, name, role } });
}
