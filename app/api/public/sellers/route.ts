import { connection, NextResponse, type NextRequest } from "next/server";
import { cleanParam, listSellers } from "@/lib/v2/public-data";

// Public shop directory. Shops with an online team come first.
export async function GET(req: NextRequest) {
  await connection();
  const params = req.nextUrl.searchParams;
  try {
    return NextResponse.json(await listSellers(cleanParam(params.get("q")), cleanParam(params.get("country"))));
  } catch (err) {
    console.error("public sellers failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Could not load shops. Please try again." }, { status: 500 });
  }
}
