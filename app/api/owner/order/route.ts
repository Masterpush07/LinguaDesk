import { NextResponse, type NextRequest } from "next/server";
import { localizeOrder } from "@/lib/bot-ai";
import {
  ENGLISH_LABELS,
  orderSummary,
  priceOrder,
  type OrderCard,
} from "@/lib/catalog";
import { db } from "@/lib/db";
import { sendDirectText } from "@/lib/nexconn-server";
import { CUSTOMER_ID, isOwner } from "@/lib/owner-auth";
import { SHOP_ID } from "@/lib/shop";
import { getShop } from "@/lib/shop-store";

// Owner sends an order card. Prices come from the shop's settings in code; the AI only translates the card's words.
export async function POST(req: NextRequest) {
  if (!(await isOwner()))
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as {
    customerId?: unknown;
    lines?: unknown;
  } | null;
  const customerId =
    typeof body?.customerId === "string" ? body.customerId : "";
  const priced = priceOrder(body?.lines, await getShop());
  if (!CUSTOMER_ID.test(customerId) || !priced)
    return NextResponse.json({ error: "Bad order" }, { status: 400 });

  const sql = db();
  const [conversation] =
    await sql`SELECT customer_id FROM conversations WHERE customer_id = ${customerId}`;
  if (!conversation)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Same rule as owner replies: the customer's latest message decides the language.
  const [last] = await sql`SELECT text, text_en FROM messages
    WHERE customer_id = ${customerId} AND sender = 'customer' ORDER BY created_at DESC LIMIT 1`;
  const customerIsEnglish =
    !!last?.text_en && last.text_en.trim() === last.text.trim();

  const base = {
    subtotal: priced.subtotal,
    shipping: priced.shipping,
    total: priced.total,
  };
  const english: OrderCard = {
    id: crypto.randomUUID(),
    lines: priced.lines.map(({ name, qty, unit, amount }) => ({
      name,
      qty,
      unit,
      amount,
    })),
    ...base,
    labels: ENGLISH_LABELS,
  };

  let card = english;
  if (last && !customerIsEnglish) {
    try {
      const local = await localizeOrder(
        english.lines.map((l) => l.name),
        last.text,
      );
      if (local)
        card = {
          ...english,
          labels: local.labels,
          lines: english.lines.map((l, i) => ({ ...l, name: local.names[i] })),
        };
    } catch (err) {
      console.error(
        "Order localization failed:",
        err instanceof Error ? err.message : err,
      ); // the English card is still correct
    }
  }

  const summary = orderSummary(card);
  const summaryEn = orderSummary(english);
  const sent = await sendDirectText(SHOP_ID, customerId, summary, {
    metadata: { order: JSON.stringify(card) },
  });
  const messageId = sent.messageIds?.[0]?.messageId ?? crypto.randomUUID();

  await sql`INSERT INTO orders (id, customer_id, card, total) VALUES (${card.id}, ${customerId}, ${JSON.stringify(card)}::jsonb, ${card.total})`;
  await sql`INSERT INTO messages (id, customer_id, sender, text, text_en)
    VALUES (${messageId}, ${customerId}, 'owner', ${summary}, ${summary === summaryEn ? null : summaryEn}) ON CONFLICT DO NOTHING`;
  await sql`UPDATE conversations SET status = 'human', last_text = ${summaryEn}, last_at = now() WHERE customer_id = ${customerId}`;
  return NextResponse.json({ ok: true, orderId: card.id });
}
