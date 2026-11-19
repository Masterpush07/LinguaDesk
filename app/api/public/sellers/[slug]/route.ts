import { connection, NextResponse, type NextRequest } from "next/server";
import { sellerDetail } from "@/lib/v2/public-data";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  await connection();
  const { slug } = await ctx.params;
  try {
    const detail = await sellerDetail(slug.slice(0, 80));
    if (!detail) return NextResponse.json({ error: "This shop does not exist." }, { status: 404 });
    return NextResponse.json(detail);
  } catch (err) {
    console.error("public seller failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Could not load this shop. Please try again." }, { status: 500 });
  }
}
