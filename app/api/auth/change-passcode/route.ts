import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { isLimited, recordEvent } from "@/lib/rate-limit";
import { hashPasscode, verifyPasscode } from "@/lib/v2/crypto";
import { requireStaff } from "@/lib/v2/guard";
import { fail, invalidBody, readJson } from "@/lib/v2/seller-api";
import { setStaffCookie } from "@/lib/v2/session";

const FAILURES = 8;
const WINDOW_MINUTES = 15;

// Changes the signed-in person's own passcode after checking the current one.
export async function POST(req: NextRequest) {
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;
  const body = await readJson(req);
  if (!body) return invalidBody();
  const current = typeof body.current === "string" ? body.current : "";
  const next = typeof body.next === "string" ? body.next : "";
  if (!current) return fail("Enter your current passcode.");
  if (next.length < 8) return fail("Choose a new passcode of at least 8 characters.");
  if (next === current) return fail("The new passcode must be different from the current passcode.");

  const key = `v2-passcode-fail:${auth.staff.id}`;
  if (await isLimited(key, FAILURES, WINDOW_MINUTES, { failClosed: true })) {
    return fail("Too many failed attempts. Try again in 15 minutes.", 429);
  }

  const sql = db();
  const [row] = await sql`SELECT passcode_hash FROM staff WHERE id = ${auth.staff.id}`;
  if (!row || !(await verifyPasscode(current, row.passcode_hash))) {
    await recordEvent(key);
    return fail("The current passcode is incorrect.", 401);
  }

  await sql`UPDATE staff SET passcode_hash = ${await hashPasscode(next)} WHERE id = ${auth.staff.id}`;
  await setStaffCookie(auth.staff.id); // the session of this device continues; every other one is signed out
  return NextResponse.json({ ok: true });
}
