import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { newId } from "@/lib/v2/crypto";
import { requireStaff } from "@/lib/v2/guard";
import { Check, fail, invalidBody, LIMITS, readJson } from "@/lib/v2/seller-api";
import { checkProduct, productDto, productImageProblem } from "@/lib/v2/seller-products";

export async function GET() {
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;
  const rows = await db()`SELECT id, name, description, category, price_usd, colors, sizes, stock, image_url, active, updated_at
    FROM products WHERE seller_id = ${auth.staff.sellerId} ORDER BY created_at DESC`;
  return NextResponse.json(rows.map(productDto));
}

export async function POST(req: NextRequest) {
  const auth = await requireStaff({ owner: true });
  if ("error" in auth) return auth.error;
  const body = await readJson(req);
  if (!body) return invalidBody();
  const check = new Check();
  const input = checkProduct(body, check);
  if (!check.ok) return check.response;
  const imageProblem = await productImageProblem(auth.staff.sellerId, input.imageUrl);
  if (imageProblem) return fail(imageProblem);

  const sql = db();
  const [{ n }] = await sql`SELECT count(*)::int AS n FROM products WHERE seller_id = ${auth.staff.sellerId}`;
  if (n >= LIMITS.productMax) return fail(`You can list at most ${LIMITS.productMax} products. Delete one before adding another.`);

  const id = newId("prd");
  const [row] = await sql`INSERT INTO products (id, seller_id, name, description, category, price_usd, colors, sizes, stock, image_url, active)
    VALUES (${id}, ${auth.staff.sellerId}, ${input.name}, ${input.description}, ${input.category}, ${input.priceUsd}, ${input.colors}, ${input.sizes}, ${input.stock}, ${input.imageUrl}, ${input.active})
    RETURNING id, name, description, category, price_usd, colors, sizes, stock, image_url, active, updated_at`;
  return NextResponse.json(productDto(row), { status: 201 });
}
