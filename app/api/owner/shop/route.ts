import { NextResponse, type NextRequest } from "next/server";
import { isOwner } from "@/lib/owner-auth";
import { validateShop } from "@/lib/shop-data";
import { getShop, saveShop } from "@/lib/shop-store";

export async function GET() {
  if (!(await isOwner()))
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  return NextResponse.json(await getShop());
}

// Saves the owner's edits. The AI, the order builder and the customer's "About" panel pick them up within seconds.
export async function PUT(req: NextRequest) {
  if (!(await isOwner()))
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const checked = validateShop(body);
  if (!checked.ok)
    return NextResponse.json(
      { error: checked.errors[0], errors: checked.errors },
      { status: 400 },
    );
  await saveShop(checked.shop);
  return NextResponse.json(checked.shop);
}
