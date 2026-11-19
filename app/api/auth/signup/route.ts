import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { issueAccessToken } from "@/lib/nexconn-server";
import { clientIp, isLimited, recordEvent } from "@/lib/rate-limit";
import { hashPasscode, newId, newNexconnId, slugify } from "@/lib/v2/crypto";
import { setStaffCookie } from "@/lib/v2/session";

const LANG = /^[a-z]{2}$/;
const SIGNUPS_PER_HOUR_PER_IP = 5;

// Creates a shop and its owner account, registers the shop's chat identity with Nexconn, and signs the owner in.
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const shopName = text(body?.shopName, 60);
  const ownerName = text(body?.ownerName, 60);
  const country = text(body?.country, 60);
  const tagline = text(body?.tagline, 200);
  const passcode = typeof body?.passcode === "string" ? body.passcode : "";
  const languages = Array.isArray(body?.languages)
    ? Array.from(new Set(["en", ...(body.languages as unknown[]).filter((l): l is string => typeof l === "string" && LANG.test(l))])).slice(0, 12)
    : ["en"];

  const errors: string[] = [];
  if (shopName.length < 2) errors.push("Enter a shop name of at least 2 characters.");
  if (!slugify(shopName)) errors.push("The shop name must contain letters or numbers.");
  if (ownerName.length < 2) errors.push("Enter your name.");
  if (passcode.length < 8) errors.push("Choose a passcode of at least 8 characters.");
  if (errors.length) return NextResponse.json({ error: errors[0], errors }, { status: 400 });

  const ipKey = `signup:${clientIp(req.headers)}`;
  if (await isLimited(ipKey, SIGNUPS_PER_HOUR_PER_IP, 60)) {
    return NextResponse.json({ error: "Too many shops created from this network. Please try again later." }, { status: 429 });
  }

  const sql = db();
  const base = slugify(shopName);
  let slug = base;
  for (let n = 2; (await sql`SELECT 1 FROM sellers WHERE slug = ${slug}`).length > 0; n++) slug = `${base.slice(0, 36)}-${n}`;

  const sellerId = newId("sel");
  const staffId = newId("stf");
  const nexconnUserId = newNexconnId("s");

  try {
    await issueAccessToken(nexconnUserId, shopName);
  } catch (err) {
    console.error("seller chat identity failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Could not set up the shop chat. Please try again." }, { status: 502 });
  }

  const hash = await hashPasscode(passcode);
  await sql`INSERT INTO sellers (id, slug, shop_name, owner_name, country, tagline, languages, nexconn_user_id)
    VALUES (${sellerId}, ${slug}, ${shopName}, ${ownerName}, ${country}, ${tagline}, ${languages}, ${nexconnUserId})`;
  await sql`INSERT INTO staff (id, seller_id, name, role, languages, passcode_hash, last_seen)
    VALUES (${staffId}, ${sellerId}, ${ownerName}, 'owner', ${languages}, ${hash}, now())`;
  await recordEvent(ipKey);
  await setStaffCookie(staffId);
  return NextResponse.json({ ok: true, seller: { id: sellerId, slug, name: shopName }, staff: { id: staffId, name: ownerName, role: "owner" } });
}
