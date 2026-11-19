import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/v2/guard";
import { Check, fail, invalidBody, LIMITS, readJson } from "@/lib/v2/seller-api";
import type { FaqDto } from "@/lib/v2/seller-types";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const auth = await requireStaff({ owner: true });
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const body = await readJson(req);
  if (!body) return invalidBody();
  const sql = db();
  const [current] = await sql`SELECT q, a FROM faqs WHERE id = ${id} AND seller_id = ${auth.staff.sellerId}`;
  if (!current) return fail("Question not found.", 404);

  const check = new Check();
  const q = check.text("q" in body ? body.q : current.q, "Question", LIMITS.faqQuestion, true);
  const a = check.text("a" in body ? body.a : current.a, "Answer", LIMITS.faqAnswer, true);
  if (!check.ok) return check.response;
  const rows = await sql`UPDATE faqs SET q = ${q}, a = ${a} WHERE id = ${id} AND seller_id = ${auth.staff.sellerId} RETURNING id`;
  if (rows.length === 0) return fail("Question not found.", 404);
  return NextResponse.json({ id, q, a } satisfies FaqDto);
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const auth = await requireStaff({ owner: true });
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const rows = await db()`DELETE FROM faqs WHERE id = ${id} AND seller_id = ${auth.staff.sellerId} RETURNING id`;
  if (rows.length === 0) return fail("Question not found.", 404);
  return NextResponse.json({ ok: true });
}
