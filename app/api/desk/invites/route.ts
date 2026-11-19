import { randomInt } from "crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/v2/guard";
import { fail, iso, LIMITS } from "@/lib/v2/seller-api";
import type { InviteDto } from "@/lib/v2/seller-types";

// No 0/O or 1/I/L, so a code read aloud or typed from a screenshot is not misread.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 8;

const makeCode = () => Array.from({ length: CODE_LENGTH }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");

export async function GET() {
  const auth = await requireStaff({ owner: true });
  if ("error" in auth) return auth.error;
  const rows = await db()`SELECT i.code, i.created_at, s.name AS created_by_name FROM invites i
    LEFT JOIN staff s ON s.id = i.created_by
    WHERE i.seller_id = ${auth.staff.sellerId} AND i.used_at IS NULL ORDER BY i.created_at DESC`;
  return NextResponse.json(rows.map((r): InviteDto => ({ code: r.code, createdAt: iso(r.created_at) ?? "", createdByName: r.created_by_name ?? null })));
}

export async function POST() {
  const auth = await requireStaff({ owner: true });
  if ("error" in auth) return auth.error;
  const sql = db();
  const [{ n }] = await sql`SELECT count(*)::int AS n FROM invites WHERE seller_id = ${auth.staff.sellerId} AND used_at IS NULL`;
  if (n >= LIMITS.inviteMax) return fail(`You can have at most ${LIMITS.inviteMax} unused invite codes. Revoke one first.`);
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = makeCode();
    const rows = await sql`INSERT INTO invites (code, seller_id, role, created_by) VALUES (${code}, ${auth.staff.sellerId}, 'agent', ${auth.staff.id})
      ON CONFLICT DO NOTHING RETURNING code`;
    if (rows.length > 0) return NextResponse.json({ code }, { status: 201 });
  }
  return fail("Could not generate a unique code. Try again.", 500);
}
