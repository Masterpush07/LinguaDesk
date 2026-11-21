import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { isLimited, recordEvent } from "@/lib/rate-limit";
import { requireBuyer } from "@/lib/v2/buyer-api";
import { newId } from "@/lib/v2/crypto";
import { requireStaff } from "@/lib/v2/guard";
import { fail, invalidBody, readJson } from "@/lib/v2/seller-api";

const MAX_ENDPOINT = 600;
const MAX_KEY = 200;
const KEY_PATTERN = /^[A-Za-z0-9_-]+={0,2}$/;

function parseSubscription(value: unknown): { endpoint: string; p256dh: string; auth: string } | null {
  if (!value || typeof value !== "object") return null;
  const { endpoint, keys } = value as { endpoint?: unknown; keys?: unknown };
  if (typeof endpoint !== "string" || endpoint.length > MAX_ENDPOINT) return null;
  try {
    if (new URL(endpoint).protocol !== "https:") return null;
  } catch {
    return null;
  }
  if (!keys || typeof keys !== "object") return null;
  const { p256dh, auth } = keys as { p256dh?: unknown; auth?: unknown };
  const valid = (k: unknown): k is string => typeof k === "string" && k.length > 0 && k.length <= MAX_KEY && KEY_PATTERN.test(k);
  if (!valid(p256dh) || !valid(auth)) return null;
  return { endpoint, p256dh, auth };
}

// Saves this browser's push address for the signed-in person. The same address always belongs to one person, so a shared browser follows whoever is signed in now.
export async function POST(req: NextRequest) {
  const body = await readJson(req);
  if (!body) return invalidBody();
  if (body.audience !== "staff" && body.audience !== "buyer") return fail("Audience must be staff or buyer.");

  let sellerId: string | null = null;
  let staffId: string | null = null;
  let buyerId: string | null = null;
  if (body.audience === "staff") {
    const auth = await requireStaff();
    if ("error" in auth) return auth.error;
    sellerId = auth.staff.sellerId;
    staffId = auth.staff.id;
  } else {
    const auth = await requireBuyer();
    if ("error" in auth) return auth.error;
    buyerId = auth.buyerId;
  }

  const sub = parseSubscription(body.subscription);
  if (!sub) return fail("The notification subscription is not valid.");

  const key = `push:${staffId ?? buyerId}`;
  if (await isLimited(key, 20, 60)) return fail("Too many attempts. Try again in a while.", 429);
  await recordEvent(key);

  await db()`INSERT INTO push_subscriptions (id, audience, seller_id, staff_id, buyer_id, endpoint, p256dh, auth)
    VALUES (${newId("psh")}, ${body.audience}, ${sellerId}, ${staffId}, ${buyerId}, ${sub.endpoint}, ${sub.p256dh}, ${sub.auth})
    ON CONFLICT (endpoint) DO UPDATE SET audience = EXCLUDED.audience, seller_id = EXCLUDED.seller_id, staff_id = EXCLUDED.staff_id,
      buyer_id = EXCLUDED.buyer_id, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth`;
  return NextResponse.json({ ok: true });
}
