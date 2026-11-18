import { NextResponse } from "next/server";
import { getShop } from "@/lib/shop-store";

// Public on purpose: it holds only what a customer may see anyway (products, prices, policies). Used by the chat's "About this shop" panel.
export async function GET() {
  return NextResponse.json(await getShop());
}
