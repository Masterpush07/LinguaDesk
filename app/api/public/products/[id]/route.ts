import { connection, NextResponse, type NextRequest } from "next/server";
import { productDetail } from "@/lib/v2/public-data";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await ctx.params;
  try {
    const product = await productDetail(id.slice(0, 80));
    if (!product) return NextResponse.json({ error: "This product does not exist." }, { status: 404 });
    return NextResponse.json(product);
  } catch (err) {
    console.error("public product failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Could not load this product. Please try again." }, { status: 500 });
  }
}
