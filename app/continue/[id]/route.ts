import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requestOrigin } from "@/lib/v2/origin";
import { setBuyerCookie } from "@/lib/v2/session";

type Ctx = { params: Promise<{ id: string }> };

const LINK_ID = /^lnk_[A-Za-z0-9_-]{12}$/;

// Opens the buyer's conversations on this device. The link works once, so claiming it and signing in happen together.
export async function GET(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const origin = requestOrigin(req);
  const invalid = () => NextResponse.redirect(new URL("/chats?link=invalid", origin));
  if (!LINK_ID.test(id)) return invalid();

  const [claimed] = await db()`UPDATE device_links SET used_at = now()
    WHERE id = ${id} AND used_at IS NULL AND expires_at > now() RETURNING buyer_id`;
  if (!claimed) return invalid();

  await setBuyerCookie(claimed.buyer_id as string);
  return NextResponse.redirect(new URL("/chats", origin));
}

// Link previews and prefetchers may probe the address first; only a real visit may use the link up.
export function HEAD() {
  return new NextResponse(null, { status: 204 });
}
