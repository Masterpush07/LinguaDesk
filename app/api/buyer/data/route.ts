import { NextResponse, type NextRequest } from "next/server";
import { isLimited, recordEvent } from "@/lib/rate-limit";
import { requireBuyer } from "@/lib/v2/buyer-api";
import { deleteBuyerData, exportBuyerData } from "@/lib/v2/buyer-privacy";
import { clearBuyerCookie } from "@/lib/v2/session";
import { fail, invalidBody, readJson } from "@/lib/v2/seller-api";

const EXPORTS_PER_HOUR = 10;
const DELETIONS_PER_HOUR = 3;

// A copy of the visitor's data as a JSON download.
export async function GET() {
  const auth = await requireBuyer();
  if ("error" in auth) return auth.error;
  const key = `privacy-export:${auth.buyerId}`;
  if (await isLimited(key, EXPORTS_PER_HOUR, 60)) return fail("You asked for your data many times. Please try again later.", 429);
  await recordEvent(key);
  const data = await exportBuyerData(auth.buyerId);
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": 'attachment; filename="my-linguadesk-data.json"', "Cache-Control": "no-store" },
  });
}

// Deletes the visitor's data (see lib/v2/buyer-privacy.ts for exactly what goes and what stays) and signs this browser out of the guest identity.
export async function DELETE(req: NextRequest) {
  const auth = await requireBuyer();
  if ("error" in auth) return auth.error;
  const body = await readJson(req);
  if (!body) return invalidBody();
  if (body.confirm !== true) return fail("Confirm that you want to delete your data.");
  const key = `privacy-delete:${auth.buyerId}`;
  if (await isLimited(key, DELETIONS_PER_HOUR, 60)) return fail("Too many deletion requests. Please try again later.", 429);
  await recordEvent(key);
  const summary = await deleteBuyerData(auth.buyerId);
  await clearBuyerCookie();
  return NextResponse.json({ ok: true, summary });
}
