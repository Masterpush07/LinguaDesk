import { NextResponse, type NextRequest } from "next/server";
import { ENGLISH_LABELS, orderSummary, priceOrder, type OrderCard } from "@/lib/catalog";
import { db } from "@/lib/db";
import { isLimited, recordEvent } from "@/lib/rate-limit";
import { notFound, requireBuyer } from "@/lib/v2/buyer-api";
import { newId } from "@/lib/v2/crypto";
import { loadShop, sellerBySlug } from "@/lib/v2/shop";

const REQUESTS_PER_HOUR = 10;

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

// "Buy now": the buyer starts an order without waiting for anyone. The price and shipping come from the shop's own catalogue and rules (never the buyer or the AI),
// the order waits as 'proposed' like a card from the team, and nothing is reserved until the buyer confirms with a delivery address.
export async function POST(req: NextRequest) {
  const auth = await requireBuyer();
  if ("error" in auth) return auth.error;
  const body = (await req.json().catch(() => null)) as { sellerSlug?: unknown; productId?: unknown; qty?: unknown; colour?: unknown; size?: unknown } | null;
  const slug = typeof body?.sellerSlug === "string" ? body.sellerSlug.trim().slice(0, 80) : "";
  const productId = typeof body?.productId === "string" ? body.productId : "";
  const qty = body?.qty;
  if (!slug || !productId || typeof qty !== "number" || !Number.isInteger(qty) || qty < 1 || qty > 20) return bad("Choose a product and a quantity from 1 to 20.");

  const key = `order-request:${auth.buyerId}`;
  if (await isLimited(key, REQUESTS_PER_HOUR, 60)) return bad("You have started many orders in a short time. Please try again later.", 429);

  const seller = await sellerBySlug(slug);
  if (!seller) return notFound("Shop");
  const sql = db();
  const [product] = await sql`SELECT id, name, colors, sizes, stock FROM products WHERE id = ${productId} AND seller_id = ${seller.id} AND active`;
  if (!product) return notFound("Product");

  const colour = typeof body?.colour === "string" && body.colour ? body.colour : null;
  const size = typeof body?.size === "string" && body.size ? body.size : null;
  if (colour && !(product.colors as string[]).includes(colour)) return bad("That colour is not offered.");
  if (size && !(product.sizes as string[]).includes(size)) return bad("That size is not offered.");
  if ((product.stock as number) < qty) {
    const have = product.stock as number;
    return bad(have === 0 ? "Sorry, this item is sold out." : `Only ${have} ${have === 1 ? "is" : "are"} in stock.`, 409);
  }

  const { shop } = await loadShop(seller.id);
  const priced = priceOrder([{ id: productId, qty }], shop);
  if (!priced) return bad("This item cannot be ordered right now.", 409);

  const options = [colour, size].filter(Boolean).join(", ");
  const card: OrderCard = {
    id: newId("ord"),
    lines: priced.lines.map(({ name, qty: n, unit, amount }) => ({ name: options ? `${name} (${options})` : name, qty: n, unit, amount })),
    subtotal: priced.subtotal,
    shipping: priced.shipping,
    total: priced.total,
    labels: ENGLISH_LABELS,
  };

  await sql`INSERT INTO buyers (id) VALUES (${auth.buyerId}) ON CONFLICT DO NOTHING`;
  await sql`INSERT INTO threads (id, seller_id, buyer_id, product_id) VALUES (${newId("thr")}, ${seller.id}, ${auth.buyerId}, ${productId})
    ON CONFLICT (seller_id, buyer_id) DO NOTHING`;
  const [thread] = await sql`SELECT id FROM threads WHERE seller_id = ${seller.id} AND buyer_id = ${auth.buyerId}`;
  const threadId = thread.id as string;
  await recordEvent(key);

  const summary = orderSummary(card);
  await sql`INSERT INTO orders_v2 (id, seller_id, thread_id, buyer_id, card, total, status)
    VALUES (${card.id}, ${seller.id}, ${threadId}, ${auth.buyerId}, ${JSON.stringify({ ...card, reserve: priced.lines.map((l) => ({ id: l.id, qty: l.qty })), selfServe: true })}::jsonb, ${card.total}, 'proposed')`;
  await sql`INSERT INTO thread_messages (id, thread_id, sender, text, numbers_verified, order_id)
    VALUES (${newId("msg")}, ${threadId}, 'ai', ${summary}, true, ${card.id})`;
  await sql`UPDATE threads SET last_text = ${summary}, last_at = now(), subject = CASE WHEN subject = '' THEN ${String(product.name).slice(0, 80)} ELSE subject END WHERE id = ${threadId}`;
  return NextResponse.json({ ok: true, orderId: card.id, threadId, sellerSlug: seller.slug }, { status: 201 });
}
