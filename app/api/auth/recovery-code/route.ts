import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { isLimited, recordEvent } from "@/lib/rate-limit";
import { verifyPasscode } from "@/lib/v2/crypto";
import { requireStaff } from "@/lib/v2/guard";
import { issueRecoveryCode } from "@/lib/v2/recovery";
import { fail, invalidBody, readJson } from "@/lib/v2/seller-api";

const FAILURES = 8;
const WINDOW_MINUTES = 15;

// Whether the owner has a recovery code. The code itself is never readable.
export async function GET() {
  const auth = await requireStaff({ owner: true });
  if ("error" in auth) return auth.error;
  const [row] = await db()`SELECT recovery_hash IS NOT NULL AS has_code FROM staff WHERE id = ${auth.staff.id}`;
  return NextResponse.json({ set: row?.has_code === true });
}

// Creates a new recovery code after the passcode is confirmed. The previous code stops working. The new code is returned once.
export async function POST(req: NextRequest) {
  const auth = await requireStaff({ owner: true });
  if ("error" in auth) return auth.error;
  const body = await readJson(req);
  if (!body) return invalidBody();
  const passcode = typeof body.passcode === "string" ? body.passcode : "";
  if (!passcode) return fail("Enter your current passcode.");

  const key = `v2-passcode-fail:${auth.staff.id}`;
  if (await isLimited(key, FAILURES, WINDOW_MINUTES, { failClosed: true })) {
    return fail("Too many failed attempts. Try again in 15 minutes.", 429);
  }

  const [row] = await db()`SELECT passcode_hash FROM staff WHERE id = ${auth.staff.id}`;
  if (!row || !(await verifyPasscode(passcode, row.passcode_hash))) {
    await recordEvent(key);
    return fail("The passcode is incorrect.", 401);
  }

  const recoveryCode = await issueRecoveryCode(auth.staff.id);
  return NextResponse.json({ ok: true, recoveryCode });
}
