import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { clientIp, isLimited, recordEvent } from "@/lib/rate-limit";
import { slugify, verifyPasscode } from "@/lib/v2/crypto";
import { setStaffCookie } from "@/lib/v2/session";
import { counterpartSlug } from "@/lib/v2/slug-aliases";

const PER_IP_FAILURES = 8;
const PER_ACCOUNT_FAILURES = 50; // spread-out guessing against one account; high enough that a few wrong tries by others never block the owner
const WINDOW_MINUTES = 15;
// Compared against when the account does not exist, so a missing account takes about as long as a wrong passcode.
const DUMMY_HASH = "00000000000000000000000000000000:0000000000000000000000000000000000000000000000000000000000000000";

// Staff sign-in: shop name, own name and passcode. The same error is returned for every kind of mismatch.
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const shop = typeof body?.shop === "string" ? body.shop.trim().slice(0, 80) : "";
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 60) : "";
  const passcode = typeof body?.passcode === "string" ? body.passcode : "";
  if (!shop || !name || !passcode) return NextResponse.json({ error: "Enter the shop name, your name and your passcode." }, { status: 400 });

  const ipKey = `v2-login-fail:${clientIp(req.headers)}`;
  const accountKey = `v2-login-acct:${slugify(shop)}:${name.toLowerCase()}`;
  if ((await isLimited(ipKey, PER_IP_FAILURES, WINDOW_MINUTES, { failClosed: true })) || (await isLimited(accountKey, PER_ACCOUNT_FAILURES, 60, { failClosed: true }))) {
    return NextResponse.json({ error: "Too many failed attempts. Try again in 15 minutes." }, { status: 429 });
  }

  // The other slug of a renamed shop (lib/v2/slug-aliases.ts) also finds it, but only while the typed slug is not a shop of its own,
  // so an alias can never lead into a different shop. A direct match on what was typed is preferred.
  const typedSlug = slugify(shop);
  const other = counterpartSlug(typedSlug);
  const [row] = await db()`SELECT st.id, st.name, st.role, st.passcode_hash, s.slug, s.shop_name
    FROM staff st JOIN sellers s ON s.id = st.seller_id
    WHERE (s.slug = ${typedSlug}
        OR (s.slug = ANY(${other ? [other] : []}) AND NOT EXISTS (SELECT 1 FROM sellers x WHERE x.slug = ${typedSlug}))
        OR lower(s.shop_name) = ${shop.toLowerCase()})
      AND lower(st.name) = ${name.toLowerCase()}
    ORDER BY (s.slug = ${typedSlug} OR lower(s.shop_name) = ${shop.toLowerCase()}) DESC`;
  const ok = await verifyPasscode(passcode, row?.passcode_hash ?? DUMMY_HASH);
  if (!row || !ok) {
    await Promise.all([recordEvent(ipKey), recordEvent(accountKey)]);
    return NextResponse.json({ error: "The shop, name or passcode is incorrect." }, { status: 401 });
  }

  await db()`UPDATE staff SET last_seen = now() WHERE id = ${row.id}`;
  await setStaffCookie(row.id);
  return NextResponse.json({ ok: true, seller: { slug: row.slug, name: row.shop_name }, staff: { id: row.id, name: row.name, role: row.role } });
}
