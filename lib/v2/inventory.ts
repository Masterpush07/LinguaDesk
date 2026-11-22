import { db } from "@/lib/db";
import type { Delivery } from "@/lib/v2/delivery";

// Server-only. Stock is reserved when the buyer confirms an order and given back if a confirmed or packed order is cancelled.
// The proposal stores what to reserve in card.reserve ([{ id, qty }]); card.reserved says whether the stock is currently held,
// so orders confirmed before this existed are never "restocked" for stock that was not taken.

type Confirmed = { seller_id: string; card: unknown; total: number };
export type ConfirmResult = { kind: "confirmed"; order: Confirmed } | { kind: "out_of_stock" } | { kind: "not_waiting" };

// 23514 is the stock >= 0 check on products: if two buyers ever slip past the guard in the same instant, the loser still gets the "sold out" answer.
const isSoldOut = (err: unknown) => ["22012", "23514"].includes((err as { code?: string })?.code ?? "") || /division by zero|stock_check/i.test(err instanceof Error ? err.message : "");

// One statement does everything: it claims the order, takes the stock and marks the order confirmed, or does none of it.
// A product's UPDATE only matches while stock >= qty (re-checked after waiting for a concurrent buyer), and the division by zero
// below aborts the whole statement when any line could not be taken, so nothing is half reserved and stock never goes negative.
export async function confirmOrderWithStock(orderId: string, buyerId: string, delivery: Delivery): Promise<ConfirmResult> {
  try {
    const rows = await db()`WITH o AS (
        SELECT id, seller_id, card FROM orders_v2 WHERE id = ${orderId} AND buyer_id = ${buyerId} AND status = 'proposed' FOR UPDATE
      ),
      want AS (
        SELECT o.seller_id AS sid, r->>'id' AS pid, sum((r->>'qty')::int)::int AS qty
        FROM o, jsonb_array_elements(COALESCE(o.card->'reserve', '[]'::jsonb)) r GROUP BY 1, 2
      ),
      taken AS (
        UPDATE products p SET stock = p.stock - w.qty, updated_at = now()
        FROM want w WHERE p.id = w.pid AND p.seller_id = w.sid AND p.active AND p.stock >= w.qty RETURNING p.id
      ),
      enough AS (
        SELECT 1 / CASE WHEN (SELECT count(*) FROM taken) = (SELECT count(*) FROM want) THEN 1 ELSE 0 END AS ok
      )
      UPDATE orders_v2 x SET status = 'confirmed', confirmed_at = now(), updated_at = now(), delivery = ${JSON.stringify(delivery)}::jsonb,
        card = CASE WHEN EXISTS (SELECT 1 FROM want) THEN jsonb_set(x.card, '{reserved}', 'true'::jsonb) ELSE x.card END
      FROM o, enough WHERE x.id = o.id AND x.status = 'proposed' AND enough.ok = 1
      RETURNING x.seller_id, x.card, x.total`;
    return rows.length > 0 ? { kind: "confirmed", order: rows[0] as Confirmed } : { kind: "not_waiting" };
  } catch (err) {
    if (isSoldOut(err)) return { kind: "out_of_stock" };
    throw err;
  }
}

// Gives back the stock of a cancelled order. The claim and the restock are one statement and the flag is cleared in it, so running this twice restocks once.
export async function releaseReservedStock(orderId: string): Promise<number> {
  const rows = await db()`WITH c AS (
      UPDATE orders_v2 SET card = jsonb_set(card, '{reserved}', 'false'::jsonb)
      WHERE id = ${orderId} AND status = 'cancelled' AND card->>'reserved' = 'true' RETURNING seller_id, card
    ),
    want AS (
      SELECT c.seller_id AS sid, r->>'id' AS pid, sum((r->>'qty')::int)::int AS qty
      FROM c, jsonb_array_elements(COALESCE(c.card->'reserve', '[]'::jsonb)) r GROUP BY 1, 2
    )
    UPDATE products p SET stock = p.stock + w.qty, updated_at = now() FROM want w WHERE p.id = w.pid AND p.seller_id = w.sid RETURNING p.id`;
  return rows.length;
}
