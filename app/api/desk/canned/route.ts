import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { newId } from "@/lib/v2/crypto";
import { requireStaff } from "@/lib/v2/guard";
import { Check, fail, invalidBody, LIMITS, readJson } from "@/lib/v2/seller-api";
import type { CannedDto } from "@/lib/v2/seller-types";

export async function GET() {
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;
  const rows = await db()`SELECT id, title, body FROM canned_replies WHERE seller_id = ${auth.staff.sellerId} ORDER BY lower(title)`;
  return NextResponse.json(rows.map((r): CannedDto => ({ id: r.id, title: r.title, body: r.body })));
}

export async function POST(req: NextRequest) {
  const auth = await requireStaff({ owner: true });
  if ("error" in auth) return auth.error;
  const body = await readJson(req);
  if (!body) return invalidBody();
  const check = new Check();
  const title = check.text(body.title, "Title", LIMITS.cannedTitle, true);
  const text = check.text(body.body, "Reply text", LIMITS.cannedBody, true);
  if (!check.ok) return check.response;

  const sql = db();
  const [{ n }] = await sql`SELECT count(*)::int AS n FROM canned_replies WHERE seller_id = ${auth.staff.sellerId}`;
  if (n >= LIMITS.cannedMax) return fail(`You can save at most ${LIMITS.cannedMax} canned replies.`);
  const id = newId("cnd");
  await sql`INSERT INTO canned_replies (id, seller_id, title, body) VALUES (${id}, ${auth.staff.sellerId}, ${title}, ${text})`;
  return NextResponse.json({ id, title, body: text } satisfies CannedDto, { status: 201 });
}
