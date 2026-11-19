import { connection, NextResponse, type NextRequest } from "next/server";
import { cleanParam, listProducts } from "@/lib/v2/public-data";

// Active products across all shops, newest first, at most 60.
export async function GET(req: NextRequest) {
  await connection();
  const params = req.nextUrl.searchParams;
  try {
    return NextResponse.json(await listProducts(cleanParam(params.get("q")), cleanParam(params.get("category")), cleanParam(params.get("country"))));
  } catch (err) {
    console.error("public products failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Could not load products. Please try again." }, { status: 500 });
  }
}
