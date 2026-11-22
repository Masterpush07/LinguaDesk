import { NextResponse, type NextRequest } from "next/server";
import { currentStaff } from "@/lib/v2/session";

// Who is signed in? Desk screens need a 401 to send signed-out people to /login.
// The public header passes ?optional=1 and gets null instead, so ordinary visitors do not log an error on every page.
export async function GET(req: NextRequest) {
  const staff = await currentStaff();
  if (!staff) {
    if (req.nextUrl.searchParams.get("optional") === "1") return NextResponse.json(null);
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  return NextResponse.json(staff);
}
