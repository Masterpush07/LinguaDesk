import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/v2/guard";
import { Check, fail, invalidBody, readJson } from "@/lib/v2/seller-api";
import { checkProduct, productDto } from "@/lib/v2/seller-products";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const auth = await requireStaff({ owner: true });
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const body = await readJson(req);
  if (!body) return invalidBody();

  const sql = db();
  const [current] = await sql`SELECT id, name, description, category, price_usd, colors, sizes, stock, image_url, active, updated_at
    FROM products WHERE id = ${id} AND seller_id = ${auth.staff.sellerId}`;
  if (!current) return fail("Product not found.", 404);

  const merged = {
    name: current.name,
    description: current.description,
    category: current.category,
    priceUsd: current.price_usd,
    colors: current.colors,
    sizes: current.sizes,
    stock: current.stock,
    imageUrl: current.image_url,
    active: current.active,
    ...Object.fromEntries(
      ["name", "description", "category", "priceUsd", "colors", "sizes", "stock", "imageUrl", "active"].filter((k) => k in body).map((k) => [k, body[k]]),
    ),
  };
  if ("active" in body && typeof body.active !== "boolean") return fail("Active must be true or false.");
  const check = new Check();
  const input = checkProduct(merged, check);
  if (!check.ok) return check.response;

  const [row] = await sql`UPDATE products SET name = ${input.name}, description = ${input.description}, category = ${input.category},
      price_usd = ${input.priceUsd}, colors = ${input.colors}, sizes = ${input.sizes}, stock = ${input.stock},
      image_url = ${input.imageUrl}, active = ${input.active}, updated_at = now()
    WHERE id = ${id} AND seller_id = ${auth.staff.sellerId}
    RETURNING id, name, description, category, price_usd, colors, sizes, stock, image_url, active, updated_at`;
  if (!row) return fail("Product not found.", 404);
  return NextResponse.json(productDto(row));
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const auth = await requireStaff({ owner: true });
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const rows = await db()`DELETE FROM products WHERE id = ${id} AND seller_id = ${auth.staff.sellerId} RETURNING id`;
  if (rows.length === 0) return fail("Product not found.", 404);
  return NextResponse.json({ ok: true });
}
