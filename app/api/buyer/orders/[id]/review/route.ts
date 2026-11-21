import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { notFound, requireBuyer } from "@/lib/v2/buyer-api";
import { newId } from "@/lib/v2/crypto";
import { notifyShop } from "@/lib/v2/notifications";
import { Check, fail, invalidBody, readJson } from "@/lib/v2/seller-api";

// A verified review: only the buyer of a delivered order, once per order (reviews.order_id is unique).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireBuyer();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const body = await readJson(req);
  if (!body) return invalidBody();
  const check = new Check();
  const rating = check.whole(body.rating, "Rating", 1, 5);
  const text = check.text(body.body, "Review", 600);
  if (!check.ok) return check.response;

  const sql = db();
  const [order] = await sql`SELECT id, seller_id, thread_id, status FROM orders_v2 WHERE id = ${id} AND buyer_id = ${auth.buyerId}`;
  if (!order) return notFound("Order");
  if (order.status !== "delivered") return fail("You can review an order after it is delivered.", 409);

  const created = await sql`INSERT INTO reviews (id, order_id, seller_id, buyer_id, rating, body)
    VALUES (${newId("rev")}, ${id}, ${order.seller_id}, ${auth.buyerId}, ${rating}, ${text})
    ON CONFLICT (order_id) DO NOTHING RETURNING id`;
  if (created.length === 0) return fail("You have already reviewed this order.", 409);

  const excerpt = text.length > 120 ? `${text.slice(0, 119).trimEnd()}…` : text;
  await notifyShop(order.seller_id, order.thread_id ?? null, "review_received", "New review", `${rating} ${rating === 1 ? "star" : "stars"}${excerpt ? `: ${excerpt}` : ""}`);
  return NextResponse.json({ ok: true }, { status: 201 });
}
