import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { isLimited, recordEvent } from "@/lib/rate-limit";
import { iso, loadThreadView, notFound, requireBuyer } from "@/lib/v2/buyer-api";
import type { BuyerSelection, BuyerThreadSummary } from "@/lib/v2/buyer-types";
import { newId } from "@/lib/v2/crypto";
import { sanitizeSelection } from "@/lib/v2/selection";
import { sellerBySlug } from "@/lib/v2/shop";

const NEW_THREADS_PER_HOUR = 40;

// Conversations that have at least one message, newest first.
export async function GET() {
  const auth = await requireBuyer();
  if ("error" in auth) return auth.error;
  const rows = await db()`SELECT t.id, t.status, s.slug, s.shop_name, s.country, p.name AS product_name,
      lm.text AS last_text, lm.sender AS last_sender, lm.created_at AS last_at,
      (SELECT count(*)::int FROM thread_messages x WHERE x.thread_id = t.id AND x.sender IN ('staff', 'ai') AND x.created_at > t.buyer_read_at) AS unread
    FROM threads t
    JOIN sellers s ON s.id = t.seller_id
    LEFT JOIN products p ON p.id = t.product_id
    JOIN LATERAL (
      SELECT text, sender, created_at FROM thread_messages WHERE thread_id = t.id ORDER BY created_at DESC LIMIT 1
    ) lm ON true
    WHERE t.buyer_id = ${auth.buyerId}
    ORDER BY lm.created_at DESC
    LIMIT 100`;
  const threads = rows.map(
    (r): BuyerThreadSummary => ({
      id: r.id,
      seller: { slug: r.slug, name: r.shop_name, country: r.country },
      status: r.status,
      lastText: r.last_text,
      lastAt: iso(r.last_at) as string,
      lastSender: r.last_sender,
      productName: r.product_name ?? null,
      unread: r.unread ?? 0,
    }),
  );
  return NextResponse.json(threads);
}

// Opens (or returns) the buyer's conversation with a shop, optionally tied to a product the buyer is asking about.
export async function POST(req: NextRequest) {
  const auth = await requireBuyer();
  if ("error" in auth) return auth.error;
  const body = (await req.json().catch(() => null)) as { sellerSlug?: unknown; productId?: unknown; selection?: unknown } | null;
  const slug = typeof body?.sellerSlug === "string" ? body.sellerSlug.trim() : "";
  const productId = typeof body?.productId === "string" && body.productId ? body.productId : null;
  if (!slug || slug.length > 80) return NextResponse.json({ error: "Choose a shop to talk to" }, { status: 400 });

  const seller = await sellerBySlug(slug);
  if (!seller) return notFound("Shop");

  const sql = db();
  let validProductId: string | null = null;
  let selection: BuyerSelection | null = null;
  if (productId) {
    const [p] = await sql`SELECT id, colors FROM products WHERE id = ${productId} AND seller_id = ${seller.id} AND active`;
    validProductId = p?.id ?? null;
    if (p) selection = sanitizeSelection(body?.selection, Array.isArray(p.colors) ? (p.colors as string[]) : []);
  }

  const [existing] = await sql`SELECT id, product_id FROM threads WHERE seller_id = ${seller.id} AND buyer_id = ${auth.buyerId}`;
  let threadId: string = existing?.id;
  if (!existing) {
    const key = `thread:${auth.buyerId}`;
    if (await isLimited(key, NEW_THREADS_PER_HOUR, 60)) {
      return NextResponse.json({ error: "You have opened many conversations in a short time. Please try again later." }, { status: 429 });
    }
    await sql`INSERT INTO buyers (id) VALUES (${auth.buyerId}) ON CONFLICT DO NOTHING`;
    await sql`INSERT INTO threads (id, seller_id, buyer_id, product_id, selection) VALUES (${newId("thr")}, ${seller.id}, ${auth.buyerId}, ${validProductId}, ${selection ? JSON.stringify(selection) : null}::jsonb)
      ON CONFLICT (seller_id, buyer_id) DO NOTHING`;
    await recordEvent(key);
    const [created] = await sql`SELECT id FROM threads WHERE seller_id = ${seller.id} AND buyer_id = ${auth.buyerId}`;
    threadId = created.id;
  } else {
    if (validProductId && !existing.product_id) {
      await sql`UPDATE threads SET product_id = ${validProductId} WHERE id = ${existing.id} AND product_id IS NULL`;
    }
    // A new selection replaces the old one, but only for the product the conversation is about.
    if (selection && (existing.product_id ?? validProductId) === validProductId) {
      await sql`UPDATE threads SET selection = ${JSON.stringify(selection)}::jsonb WHERE id = ${existing.id}`;
    }
  }

  const view = await loadThreadView(threadId, auth.buyerId);
  if (!view) return notFound("Conversation");
  return NextResponse.json(view);
}
