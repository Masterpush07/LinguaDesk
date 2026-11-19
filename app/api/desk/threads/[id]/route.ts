import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import type { OrderCard } from "@/lib/catalog";
import { requireStaff } from "@/lib/v2/guard";
import { buyerLabel, fail, iso8601, loadBuyerOrders, loadHead, loadTeam } from "@/lib/v2/desk-threads";
import type { DeskEvent, DeskMessage, DeskNote, ThreadDetail } from "@/lib/v2/desk-types";

type Ctx = { params: Promise<{ id: string }> };

// One conversation with its messages, notes, history, the buyer's orders and the team.
export async function GET(_req: NextRequest, ctx: Ctx) {
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;
  const { staff } = auth;
  const { id } = await ctx.params;
  const thread = await loadHead(staff, id);
  if (!thread) return fail(404, "Conversation not found.");

  const sql = db();
  const [[buyer], messages, notes, events, orders, product, team] = await Promise.all([
    sql`SELECT id, name, language FROM buyers WHERE id = ${thread.buyer.id}`,
    sql`SELECT m.id, m.sender, m.text, m.text_en, m.lang, m.voice_seconds, m.confidence, m.numbers_verified, m.created_at,
        st.name AS staff_name, o.card
      FROM thread_messages m
      LEFT JOIN staff st ON st.id = m.staff_id
      LEFT JOIN orders_v2 o ON o.id = m.order_id AND o.seller_id = ${staff.sellerId}
      WHERE m.thread_id = ${id} ORDER BY m.created_at, m.id LIMIT 300`,
    sql`SELECT n.id, n.text, n.created_at, st.name AS staff_name
      FROM thread_notes n LEFT JOIN staff st ON st.id = n.staff_id WHERE n.thread_id = ${id} ORDER BY n.created_at`,
    sql`SELECT type, actor, payload, at FROM thread_events WHERE thread_id = ${id} ORDER BY at, id`,
    loadBuyerOrders(staff.sellerId, thread.buyer.id),
    sql`SELECT p.id, p.name, p.price_usd, p.image_url FROM threads t JOIN products p ON p.id = t.product_id
      WHERE t.id = ${id} AND p.seller_id = ${staff.sellerId}`,
    loadTeam(staff.sellerId),
  ]);

  const body: ThreadDetail = {
    thread,
    buyer: { id: thread.buyer.id, label: buyerLabel(buyer.id, buyer.name), name: buyer.name, language: buyer.language },
    messages: messages.map(
      (m): DeskMessage => ({
        id: m.id,
        sender: m.sender,
        text: m.text,
        // A staff message with no stored original was written in English, so the English text is the text itself.
        textEn: m.text_en ?? (m.sender === "staff" ? m.text : null),
        lang: m.lang,
        voiceSeconds: m.voice_seconds,
        numbersVerified: m.numbers_verified,
        confidence: m.confidence,
        createdAt: iso8601(m.created_at),
        staffName: m.staff_name,
        order: (m.card as OrderCard | null) ?? null,
      }),
    ),
    notes: notes.map((n): DeskNote => ({ id: n.id, text: n.text, staffName: n.staff_name, createdAt: iso8601(n.created_at) })),
    events: events.map((e): DeskEvent => ({ type: e.type, actor: e.actor, payload: e.payload ?? {}, at: iso8601(e.at) })),
    orders,
    product: product[0] ? { id: product[0].id, name: product[0].name, priceUsd: product[0].price_usd, imageUrl: product[0].image_url } : null,
    team: team.map((member) => ({
      id: member.id,
      name: member.name,
      role: member.role,
      languages: member.languages,
      online: member.online,
      available: member.available,
      load: member.load,
      maxConcurrent: member.maxConcurrent,
    })),
  };
  return NextResponse.json(body);
}
