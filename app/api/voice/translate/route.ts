import { NextResponse, type NextRequest } from "next/server";
import { isLimited, recordEvent } from "@/lib/rate-limit";
import { currentBuyerId, currentStaff } from "@/lib/v2/session";
import { translateToEnglish } from "@/lib/v2/voice";

const PER_10_MIN = 60;

// English preview for an edited voice transcript. Nothing is stored.
export async function POST(req: NextRequest) {
  const staff = await currentStaff();
  const identity = staff ? `staff:${staff.id}` : `buyer:${(await currentBuyerId()) ?? ""}`;
  if (identity === "buyer:") return NextResponse.json({ error: "Start a conversation first." }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { text?: unknown } | null;
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!text) return NextResponse.json({ error: "Enter some text to translate." }, { status: 400 });

  const key = `voice-translate:${identity}`;
  if (await isLimited(key, PER_10_MIN, 10)) return NextResponse.json({ error: "Too many requests. Please wait a few minutes." }, { status: 429 });
  await recordEvent(key);
  try {
    return NextResponse.json({ english: await translateToEnglish(text) });
  } catch (err) {
    console.error("voice translate failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "The English preview is unavailable right now." }, { status: 502 });
  }
}
