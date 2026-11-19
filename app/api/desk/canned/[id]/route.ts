import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/v2/guard";
import { fail } from "@/lib/v2/seller-api";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const auth = await requireStaff({ owner: true });
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const rows = await db()`DELETE FROM canned_replies WHERE id = ${id} AND seller_id = ${auth.staff.sellerId} RETURNING id`;
  if (rows.length === 0) return fail("Canned reply not found.", 404);
  return NextResponse.json({ ok: true });
}
