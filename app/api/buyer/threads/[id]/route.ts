import { NextResponse, type NextRequest } from "next/server";
import { loadThreadView, notFound, requireBuyer } from "@/lib/v2/buyer-api";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireBuyer();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const view = await loadThreadView(id, auth.buyerId);
  if (!view) return notFound("Conversation");
  return NextResponse.json(view);
}
