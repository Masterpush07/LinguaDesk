import { NextResponse, type NextRequest } from "next/server";
import { requireStaff } from "@/lib/v2/guard";
import { computeAnalytics } from "@/lib/v2/seller-analytics";
import { fail, timeZoneFrom } from "@/lib/v2/seller-api";

export async function GET(req: NextRequest) {
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;
  const raw = req.nextUrl.searchParams.get("days") ?? "7";
  if (raw !== "7" && raw !== "30") return fail("days must be 7 or 30.");
  return NextResponse.json(await computeAnalytics(auth.staff.sellerId, Number(raw), timeZoneFrom(req)));
}
