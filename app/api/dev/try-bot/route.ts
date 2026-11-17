import { NextResponse, type NextRequest } from "next/server";
import { generateReply } from "@/lib/bot-ai";

// Developer-only: shows what the AI would answer without sending anything to a customer.
export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === "production") return new NextResponse("Not found", { status: 404 });
  const text = req.nextUrl.searchParams.get("text") ?? "";
  const model = req.nextUrl.searchParams.get("model");
  try {
    return NextResponse.json(await generateReply(text, model ? [model] : undefined));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 502 });
  }
}
