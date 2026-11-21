import { db } from "@/lib/db";
import { newId } from "@/lib/v2/crypto";
import type { NotificationKind } from "@/lib/v2/notification-types";

// Server-only. In-app alerts for a shop's team: the assistant could not answer, the buyer asked for a person, an order was confirmed.

const clip = (value: string, max: number) => (value.length > max ? `${value.slice(0, max - 1).trimEnd()}…` : value);

// One unread alert per conversation and kind: a repeated question refreshes it instead of piling up new ones.
// A failure here is logged and swallowed, because an alert must never stop the buyer from getting an answer.
export async function notifyShop(sellerId: string, threadId: string | null, kind: NotificationKind, title: string, body: string) {
  const sql = db();
  const text = clip(body.replace(/\s+/g, " ").trim(), 240);
  try {
    if (threadId) {
      const refreshed = await sql`UPDATE notifications SET title = ${title}, body = ${text}, created_at = now()
        WHERE seller_id = ${sellerId} AND thread_id = ${threadId} AND kind = ${kind} AND read_at IS NULL RETURNING id`;
      if (refreshed.length > 0) return;
    }
    await sql`INSERT INTO notifications (id, seller_id, thread_id, kind, title, body) VALUES (${newId("ntf")}, ${sellerId}, ${threadId}, ${kind}, ${title}, ${text})`;
  } catch (err) {
    console.error("notification failed:", err instanceof Error ? err.message : err);
  }
}
