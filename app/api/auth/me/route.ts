import { NextResponse } from "next/server";
import { currentStaff } from "@/lib/v2/session";

// Who is signed in? Used by the desk screens to decide what to show.
export async function GET() {
  const staff = await currentStaff();
  if (!staff) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  return NextResponse.json(staff);
}
