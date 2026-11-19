import { NextResponse } from "next/server";
import { currentStaff, type Staff } from "@/lib/v2/session";

// Server-only. Every /api/desk route starts with this: it returns the signed-in staff member, or the 401/403 response to send back.
export async function requireStaff(options: { owner?: boolean } = {}): Promise<{ staff: Staff } | { error: NextResponse }> {
  const staff = await currentStaff();
  if (!staff) return { error: NextResponse.json({ error: "Not signed in" }, { status: 401 }) };
  if (options.owner && staff.role !== "owner") {
    return { error: NextResponse.json({ error: "This action is available to the shop owner only." }, { status: 403 }) };
  }
  return { staff };
}
