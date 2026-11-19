import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { newId } from "@/lib/v2/crypto";
import { requireStaff } from "@/lib/v2/guard";
import { Check, fail, invalidBody, LIMITS, readJson } from "@/lib/v2/seller-api";
import type { FaqDto } from "@/lib/v2/seller-types";

export async function GET() {
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;
  const rows = await db()`SELECT id, q, a FROM faqs WHERE seller_id = ${auth.staff.sellerId} ORDER BY created_at`;
  return NextResponse.json(rows.map((r): FaqDto => ({ id: r.id, q: r.q, a: r.a })));
}

export async function POST(req: NextRequest) {
  const auth = await requireStaff({ owner: true });
  if ("error" in auth) return auth.error;
  const body = await readJson(req);
  if (!body) return invalidBody();
  const check = new Check();
  const q = check.text(body.q, "Question", LIMITS.faqQuestion, true);
  const a = check.text(body.a, "Answer", LIMITS.faqAnswer, true);
  if (!check.ok) return check.response;

  const sql = db();
  const [{ n }] = await sql`SELECT count(*)::int AS n FROM faqs WHERE seller_id = ${auth.staff.sellerId}`;
  if (n >= LIMITS.faqMax) return fail(`You can add at most ${LIMITS.faqMax} questions. Delete one before adding another.`);
  const id = newId("faq");
  await sql`INSERT INTO faqs (id, seller_id, q, a) VALUES (${id}, ${auth.staff.sellerId}, ${q}, ${a})`;
  return NextResponse.json({ id, q, a } satisfies FaqDto, { status: 201 });
}
