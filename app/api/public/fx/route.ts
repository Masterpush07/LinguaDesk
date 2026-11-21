import { connection, NextResponse } from "next/server";
import { getRates } from "@/lib/v2/fx";

// Reference exchange rates for showing prices. Never fails: the worst case is the built-in fallback table.
export async function GET() {
  await connection();
  return NextResponse.json(await getRates(), { headers: { "Cache-Control": "public, max-age=3600" } });
}
