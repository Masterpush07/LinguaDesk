import { randomBytes } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { clientIp, isLimited, recordEvent } from "@/lib/rate-limit";
import { requireBuyer } from "@/lib/v2/buyer-api";
import { emailConfigured, isSupportedLanguage, sendConfirmEmail } from "@/lib/v2/buyer-alert";
import { requestOrigin } from "@/lib/v2/origin";

// Email notifications for a buyer. The browser popup lives in /api/push; this route only handles the email address.
const EMAIL_RE = /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']{2,}$/;
const mask = (email: string) => email.replace(/^(.).*(@.*)$/, "$1***$2");

export async function GET() {
  const auth = await requireBuyer();
  if ("error" in auth) return auth.error;
  const [row] = await db()`SELECT email, verified_at FROM buyer_emails WHERE buyer_id = ${auth.buyerId}`;
  return NextResponse.json({ emailAvailable: emailConfigured(), email: row ? { masked: mask(row.email), verified: Boolean(row.verified_at) } : null });
}

export async function POST(req: NextRequest) {
  const auth = await requireBuyer();
  if ("error" in auth) return auth.error;
  if (!emailConfigured()) return NextResponse.json({ error: "Email notifications are not available right now." }, { status: 503 });
  const body = (await req.json().catch(() => null)) as { email?: unknown; language?: unknown } | null;
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!EMAIL_RE.test(email) || email.length > 254) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });

  // Limits keep this from being used to send confirmation emails to other people's inboxes.
  const ip = clientIp(req.headers);
  if ((await isLimited(`notify-mail:${auth.buyerId}`, 3, 60)) || (await isLimited(`notify-mail-ip:${ip}`, 10, 60))) {
    return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }
  await recordEvent(`notify-mail:${auth.buyerId}`);
  await recordEvent(`notify-mail-ip:${ip}`);

  const token = randomBytes(24).toString("hex");
  await db()`INSERT INTO buyer_emails (buyer_id, email, token) VALUES (${auth.buyerId}, ${email}, ${token})
    ON CONFLICT (buyer_id) DO UPDATE SET email = EXCLUDED.email, token = EXCLUDED.token, verified_at = NULL, created_at = now()`;
  try {
    await sendConfirmEmail(email, token, requestOrigin(req), isSupportedLanguage(body?.language) ? body.language : "en");
  } catch (err) {
    console.error("confirmation email failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "The confirmation email could not be sent. Check the address and try again." }, { status: 502 });
  }
  return NextResponse.json({ ok: true, masked: mask(email) });
}

export async function DELETE() {
  const auth = await requireBuyer();
  if ("error" in auth) return auth.error;
  await db()`DELETE FROM buyer_emails WHERE buyer_id = ${auth.buyerId}`;
  return NextResponse.json({ ok: true });
}
