import { NextResponse, type NextRequest } from "next/server";
import { loadAsset } from "@/lib/v2/assets";
import { currentBuyerId, currentStaff } from "@/lib/v2/session";

type Ctx = { params: Promise<{ id: string }> };

// Product images are public (they appear on storefronts). Chat and return photos are visible only to the buyer who sent them
// and to the shop's team.
export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!/^ast_[A-Za-z0-9_-]{6,40}$/.test(id)) return NextResponse.json({ error: "Image not found" }, { status: 404 });
  const asset = await loadAsset(id);
  if (!asset) return NextResponse.json({ error: "Image not found" }, { status: 404 });

  const isPublic = asset.kind === "product";
  if (!isPublic) {
    const [staff, buyerId] = await Promise.all([currentStaff(), currentBuyerId()]);
    const allowed = (staff && asset.seller_id === staff.sellerId) || (buyerId && asset.buyer_id === buyerId);
    // Same answer as a missing image, so the existence of a private image is not revealed.
    if (!allowed) return NextResponse.json({ error: "Image not found" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(asset.bytes), {
    headers: {
      "Content-Type": asset.mime,
      "Content-Length": String(asset.bytes.length),
      "Cache-Control": isPublic ? "public, max-age=31536000, immutable" : "private, max-age=3600",
    },
  });
}
