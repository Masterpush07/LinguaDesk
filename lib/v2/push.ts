import * as webpush from "web-push";
import { db } from "@/lib/db";

// Server-only. Web push to the shop's team or to a buyer. Free: the browsers' own push services deliver the message.
// Needs NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_SUBJECT. Without them every call does nothing,
// and no call ever throws, because a failed alert must never break the action that triggered it.

export type PushPayload = { title: string; body: string; url: string; tag?: string };
type Row = { id: string; endpoint: string; p256dh: string; auth: string };

let configured: boolean | null = null;
function ready(): boolean {
  if (configured !== null) return configured;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!pub || !priv || !subject) return (configured = false);
  webpush.setVapidDetails(subject, pub, priv);
  return (configured = true);
}

const clip = (v: string, max: number) => (v.length > max ? `${v.slice(0, max - 1).trimEnd()}…` : v);

async function deliver(rows: Row[], payload: PushPayload) {
  if (rows.length === 0) return;
  const body = JSON.stringify({ title: clip(payload.title, 80), body: clip(payload.body, 140), url: payload.url, tag: payload.tag });
  const results = await Promise.allSettled(
    rows.map((r) => webpush.sendNotification({ endpoint: r.endpoint, keys: { p256dh: r.p256dh, auth: r.auth } }, body, { TTL: 3600 })),
  );
  // A subscription the browser no longer honours (410 Gone, 404) is removed so it is not tried again.
  const dead = results.flatMap((res, i) => (res.status === "rejected" && [404, 410].includes((res.reason as { statusCode?: number })?.statusCode ?? 0) ? [rows[i].id] : []));
  if (dead.length > 0) await db()`DELETE FROM push_subscriptions WHERE id = ANY(${dead})`;
}

export async function sendToStaff(sellerId: string, payload: PushPayload): Promise<void> {
  if (!ready()) return;
  try {
    const rows = (await db()`SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE audience = 'staff' AND seller_id = ${sellerId}`) as Row[];
    await deliver(rows, payload);
  } catch (err) {
    console.error("push to staff failed:", err instanceof Error ? err.message : err);
  }
}

export async function sendToBuyer(buyerId: string, payload: PushPayload): Promise<void> {
  if (!ready()) return;
  try {
    const rows = (await db()`SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE audience = 'buyer' AND buyer_id = ${buyerId}`) as Row[];
    await deliver(rows, payload);
  } catch (err) {
    console.error("push to buyer failed:", err instanceof Error ? err.message : err);
  }
}
