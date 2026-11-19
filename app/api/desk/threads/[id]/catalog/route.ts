import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/v2/guard";
import { fail, loadHead } from "@/lib/v2/desk-threads";
import type { CatalogItem } from "@/lib/v2/desk-types";

type Ctx = { params: Promise<{ id: string }> };

// Active products of the shop, for the order builder.
export async function GET(_req: NextRequest, ctx: Ctx) {
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;
  const { id } = await ctx.params;
  if (!(await loadHead(auth.staff, id))) return fail(404, "Conversation not found.");
  const rows = await db()`SELECT id, name, price_usd, stock FROM products WHERE seller_id = ${auth.staff.sellerId} AND active ORDER BY name`;
  const items: CatalogItem[] = rows.map((r) => ({ id: r.id, name: r.name, priceUsd: r.price_usd, stock: r.stock }));
  return NextResponse.json(items);
}
