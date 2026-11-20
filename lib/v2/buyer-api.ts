import { NextResponse } from "next/server";
import { parseOrderCard } from "@/lib/catalog";
import { db } from "@/lib/db";
import type { BuyerMessage, BuyerOrder, BuyerThreadView, OrderStatus, ThreadStatus } from "@/lib/v2/buyer-types";
import { newId } from "@/lib/v2/crypto";
import { currentBuyerId } from "@/lib/v2/session";

// Server-only helpers shared by the /api/buyer routes. Every query here is scoped to the signed-in buyer.

const ONLINE_SECONDS = 90; // same window dispatch uses to decide that a team member is at their desk
const MESSAGE_LIMIT = 300;

export const NOT_STARTED = "Start a conversation first";

export async function requireBuyer(): Promise<{ buyerId: string } | { error: NextResponse }> {
  const buyerId = await currentBuyerId();
  if (!buyerId) return { error: NextResponse.json({ error: NOT_STARTED }, { status: 401 }) };
  return { buyerId };
}

export const notFound = (what: string) => NextResponse.json({ error: `${what} not found` }, { status: 404 });

export const iso = (value: unknown): string | null => (value ? new Date(value as string | Date).toISOString() : null);

export async function loadThreadView(threadId: string, buyerId: string): Promise<BuyerThreadView | null> {
  const sql = db();
  const [t] = await sql`SELECT t.id, t.status, t.language, t.handoff_at, t.sla_due_at, t.rating, t.product_id,
      st.name AS staff_name, s.id AS seller_id, s.slug, s.shop_name, s.nexconn_user_id, s.country, s.languages, s.response_target_min,
      EXISTS (SELECT 1 FROM staff o WHERE o.seller_id = s.id AND o.available AND o.last_seen > now() - make_interval(secs => ${ONLINE_SECONDS})) AS team_online
    FROM threads t
    JOIN sellers s ON s.id = t.seller_id
    LEFT JOIN staff st ON st.id = t.assigned_staff_id
    WHERE t.id = ${threadId} AND t.buyer_id = ${buyerId}`;
  if (!t) return null;

  const [productRows, rows] = await Promise.all([
    t.product_id
      ? sql`SELECT id, name, price_usd, image_url, stock FROM products WHERE id = ${t.product_id} AND seller_id = ${t.seller_id}`
      : Promise.resolve([]),
    sql`SELECT * FROM (
        SELECT m.id, m.sender, m.text, m.text_en, m.lang, m.voice_seconds, m.confidence, m.numbers_verified, m.created_at,
          sf.name AS staff_name, m.order_id, o.card, o.status AS order_status
        FROM thread_messages m
        LEFT JOIN staff sf ON sf.id = m.staff_id
        LEFT JOIN orders_v2 o ON o.id = m.order_id AND o.buyer_id = ${buyerId}
        WHERE m.thread_id = ${threadId}
        ORDER BY m.created_at DESC
        LIMIT ${MESSAGE_LIMIT}
      ) recent ORDER BY created_at`,
  ]);
  const p = productRows[0];

  const messages = rows.map(
    (m): BuyerMessage => ({
      id: m.id,
      sender: m.sender,
      text: m.text,
      textEn: m.text_en ?? null,
      lang: m.lang ?? null,
      voiceSeconds: m.voice_seconds ?? null,
      numbersVerified: !!m.numbers_verified,
      confidence: typeof m.confidence === "number" ? m.confidence : null,
      createdAt: iso(m.created_at) as string,
      staffName: m.staff_name ?? null,
      order: m.card ? parseOrderCard(JSON.stringify(m.card)) : null,
      orderId: m.card ? m.order_id : null,
      orderStatus: (m.order_status as OrderStatus | null) ?? null,
    }),
  );

  return {
    thread: {
      id: t.id,
      status: t.status as ThreadStatus,
      language: t.language ?? null,
      assignedStaff: t.staff_name ? { name: t.staff_name } : null,
      handoffAt: iso(t.handoff_at),
      slaDueAt: iso(t.sla_due_at),
      rating: t.rating ?? null,
    },
    seller: {
      slug: t.slug,
      name: t.shop_name,
      nexconnUserId: t.nexconn_user_id,
      country: t.country,
      languages: t.languages,
      teamOnline: !!t.team_online,
      responseTargetMin: t.response_target_min,
    },
    product: p ? { id: p.id, name: p.name, priceUsd: p.price_usd, imageUrl: p.image_url ?? null, stock: p.stock } : null,
    messages,
  };
}

export function toBuyerOrder(r: Record<string, unknown>): BuyerOrder {
  return {
    id: r.id as string,
    seller: { slug: r.slug as string, name: r.shop_name as string },
    threadId: (r.thread_id as string | null) ?? null,
    status: r.status as OrderStatus,
    total: r.total as number,
    createdAt: iso(r.created_at) as string,
    confirmedAt: iso(r.confirmed_at),
    courier: (r.courier as string | null) ?? null,
    tracking: (r.tracking as string | null) ?? null,
    card: r.card ? parseOrderCard(JSON.stringify(r.card)) : null,
  };
}

export async function addSystemMessage(threadId: string, text: string) {
  await db()`INSERT INTO thread_messages (id, thread_id, sender, text) VALUES (${newId("msg")}, ${threadId}, 'system', ${text})`;
}
