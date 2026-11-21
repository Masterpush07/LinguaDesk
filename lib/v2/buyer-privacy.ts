import { db } from "@/lib/db";
import { iso } from "@/lib/v2/buyer-api";

// Server-only. A buyer's right to a copy of their data and to have it deleted. There are no accounts, so "the buyer" is the guest id in the cookie.
// What is deleted: conversations and every message in them, uploaded photos, the delivery address, the review text, the return details,
// the alert email, push subscriptions and device links. What stays: the order itself (items, total, status, courier) without any personal detail,
// because the shop needs it for its own records, and a random buyer id that no longer points at a person.

export type DeletionSummary = { conversations: number; messages: number; photos: number; addresses: number; reviews: number; returns: number; email: boolean; devices: number };

export async function deleteBuyerData(buyerId: string): Promise<DeletionSummary> {
  const sql = db();
  const [c] = await sql`SELECT
      (SELECT count(*)::int FROM threads WHERE buyer_id = ${buyerId}) AS conversations,
      (SELECT count(*)::int FROM thread_messages m JOIN threads t ON t.id = m.thread_id WHERE t.buyer_id = ${buyerId}) AS messages,
      (SELECT count(*)::int FROM assets WHERE buyer_id = ${buyerId}) AS photos,
      (SELECT count(*)::int FROM orders_v2 WHERE buyer_id = ${buyerId} AND delivery IS NOT NULL) AS addresses,
      (SELECT count(*)::int FROM reviews WHERE buyer_id = ${buyerId} AND body <> '') AS reviews,
      (SELECT count(*)::int FROM return_requests WHERE buyer_id = ${buyerId}) AS returns,
      EXISTS (SELECT 1 FROM buyer_emails WHERE buyer_id = ${buyerId}) AS email,
      (SELECT count(*)::int FROM push_subscriptions WHERE buyer_id = ${buyerId} AND audience = 'buyer') AS devices`;

  // One transaction: either everything is removed or nothing is.
  await sql.transaction([
    sql`DELETE FROM tts_cache WHERE message_id IN (SELECT m.id FROM thread_messages m JOIN threads t ON t.id = m.thread_id WHERE t.buyer_id = ${buyerId})`,
    sql`DELETE FROM translation_reports WHERE buyer_id = ${buyerId}`,
    sql`UPDATE return_requests SET details = '', photo_asset_id = NULL WHERE buyer_id = ${buyerId}`,
    sql`DELETE FROM assets WHERE buyer_id = ${buyerId}`,
    sql`UPDATE reviews SET body = '' WHERE buyer_id = ${buyerId}`,
    sql`UPDATE orders_v2 SET delivery = NULL WHERE buyer_id = ${buyerId}`,
    sql`DELETE FROM threads WHERE buyer_id = ${buyerId}`,
    sql`DELETE FROM push_subscriptions WHERE buyer_id = ${buyerId} AND audience = 'buyer'`,
    sql`DELETE FROM buyer_emails WHERE buyer_id = ${buyerId}`,
    sql`DELETE FROM device_links WHERE buyer_id = ${buyerId}`,
    sql`UPDATE buyers SET name = NULL, language = NULL, last_seen = NULL, deleted_at = now() WHERE id = ${buyerId}`,
  ]);

  return { conversations: c.conversations, messages: c.messages, photos: c.photos, addresses: c.addresses, reviews: c.reviews, returns: c.returns, email: c.email === true, devices: c.devices };
}

const MESSAGE_CAP = 5000;

// Everything held about this buyer, in a readable shape.
export async function exportBuyerData(buyerId: string) {
  const sql = db();
  const [buyer] = await sql`SELECT id, language, created_at FROM buyers WHERE id = ${buyerId}`;
  const [threads, messages, orders, returns, reviews, email, devices] = await Promise.all([
    sql`SELECT t.id, t.status, t.created_at, s.shop_name, s.slug FROM threads t JOIN sellers s ON s.id = t.seller_id WHERE t.buyer_id = ${buyerId} ORDER BY t.created_at`,
    sql`SELECT m.thread_id, m.sender, m.text, m.text_en, m.created_at FROM thread_messages m JOIN threads t ON t.id = m.thread_id
      WHERE t.buyer_id = ${buyerId} ORDER BY m.created_at LIMIT ${MESSAGE_CAP}`,
    sql`SELECT o.id, o.status, o.total, o.card, o.delivery, o.courier, o.tracking, o.created_at, o.confirmed_at, o.paid_at, s.shop_name
      FROM orders_v2 o JOIN sellers s ON s.id = o.seller_id WHERE o.buyer_id = ${buyerId} ORDER BY o.created_at`,
    sql`SELECT id, order_id, reason, details, status, seller_note, created_at FROM return_requests WHERE buyer_id = ${buyerId} ORDER BY created_at`,
    sql`SELECT order_id, rating, body, created_at FROM reviews WHERE buyer_id = ${buyerId} ORDER BY created_at`,
    sql`SELECT email, verified_at FROM buyer_emails WHERE buyer_id = ${buyerId}`,
    sql`SELECT count(*)::int AS n FROM push_subscriptions WHERE buyer_id = ${buyerId} AND audience = 'buyer'`,
  ]);

  return {
    exportedAt: new Date().toISOString(),
    note: "This is the personal data LinguaDesk holds for the guest identity of this browser. There is no account; the identity is a random id kept in a cookie.",
    buyer: { id: buyerId, language: buyer?.language ?? null, createdAt: iso(buyer?.created_at) },
    alertEmail: email[0] ? { address: email[0].email, confirmed: Boolean(email[0].verified_at) } : null,
    browsersWithAlerts: devices[0]?.n ?? 0,
    conversations: threads.map((t) => ({
      shop: t.shop_name,
      shopLink: `/chat/${t.slug}`,
      status: t.status,
      startedAt: iso(t.created_at),
      messages: messages
        .filter((m) => m.thread_id === t.id)
        .map((m) => ({ at: iso(m.created_at), from: m.sender, text: m.text, english: m.text_en ?? null })),
    })),
    orders: orders.map((o) => ({
      id: o.id,
      shop: o.shop_name,
      status: o.status,
      totalUsd: o.total,
      items: Array.isArray(o.card?.lines) ? o.card.lines : [],
      deliveryAddress: o.delivery ?? null,
      courier: o.courier ?? null,
      tracking: o.tracking ?? null,
      placedAt: iso(o.created_at),
      confirmedAt: iso(o.confirmed_at),
      paidAt: iso(o.paid_at),
    })),
    returns: returns.map((r) => ({ orderId: r.order_id, reason: r.reason, details: r.details, status: r.status, shopNote: r.seller_note, requestedAt: iso(r.created_at) })),
    reviews: reviews.map((r) => ({ orderId: r.order_id, rating: r.rating, text: r.body, at: iso(r.created_at) })),
  };
}
