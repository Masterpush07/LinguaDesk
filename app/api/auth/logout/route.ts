import { NextResponse } from "next/server";
import { clearStaffCookie } from "@/lib/v2/session";

export async function POST() {
  await clearStaffCookie();
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
