import { NextResponse } from "next/server";
import { getShop } from "@/lib/shop-store";
import { legacyEnabled, legacyOff } from "@/lib/legacy";

// Public on purpose: it holds only what a customer may see anyway (products, prices, policies). Used by the chat's "About this shop" panel.
export async function GET() {
  if (!legacyEnabled()) return legacyOff();
  return NextResponse.json(await getShop());
}
