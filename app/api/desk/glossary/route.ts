import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { newId } from "@/lib/v2/crypto";
import { requireStaff } from "@/lib/v2/guard";
import { Check, fail, invalidBody, LIMITS, readJson } from "@/lib/v2/seller-api";
import type { GlossaryDto } from "@/lib/v2/seller-types";

export async function GET() {
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;
  const rows = await db()`SELECT id, term, rule, note FROM glossary WHERE seller_id = ${auth.staff.sellerId} ORDER BY lower(term)`;
  return NextResponse.json(rows.map((r): GlossaryDto => ({ id: r.id, term: r.term, rule: r.rule, note: r.note })));
}

export async function POST(req: NextRequest) {
  const auth = await requireStaff({ owner: true });
  if ("error" in auth) return auth.error;
  const body = await readJson(req);
  if (!body) return invalidBody();
  const check = new Check();
  const term = check.text(body.term, "Term", LIMITS.glossaryTerm, true);
  const rule = check.oneOf(body.rule, "Rule", ["keep", "fixed"] as const);
  const note = check.text(body.note, "Note", LIMITS.glossaryNote);
  if (check.ok && rule === "fixed" && !note) check.errors.push("Enter the wording the AI must always use for this term.");
  if (!check.ok) return check.response;

  const sql = db();
  const [{ n, dupes }] = await sql`SELECT count(*)::int AS n, count(*) FILTER (WHERE lower(term) = ${term.toLowerCase()})::int AS dupes
    FROM glossary WHERE seller_id = ${auth.staff.sellerId}`;
  if (dupes > 0) return fail(`"${term}" is already in the glossary. Remove the existing entry first.`, 409);
  if (n >= LIMITS.glossaryMax) return fail(`The glossary can hold at most ${LIMITS.glossaryMax} terms.`);
  const id = newId("gls");
  await sql`INSERT INTO glossary (id, seller_id, term, rule, note) VALUES (${id}, ${auth.staff.sellerId}, ${term}, ${rule}, ${note})`;
  return NextResponse.json({ id, term, rule, note } satisfies GlossaryDto, { status: 201 });
}
