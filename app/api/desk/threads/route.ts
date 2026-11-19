import { NextResponse, type NextRequest } from "next/server";
import { requireStaff } from "@/lib/v2/guard";
import { fail, listThreads, toSummary } from "@/lib/v2/desk-threads";
import type { ThreadFilter } from "@/lib/v2/desk-types";

const FILTERS: ThreadFilter[] = ["all", "unassigned", "mine", "critical"];

// The shop's conversations, most urgent first. Scoped to the signed-in team member's shop.
export async function GET(req: NextRequest) {
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;
  const filter = (req.nextUrl.searchParams.get("filter") ?? "all") as ThreadFilter;
  if (!FILTERS.includes(filter)) return fail(400, "Unknown filter.");
  const rows = await listThreads(auth.staff, { filter, q: req.nextUrl.searchParams.get("q") ?? "" });
  return NextResponse.json(rows.map(toSummary));
}
