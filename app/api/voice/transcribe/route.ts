import { NextResponse, type NextRequest } from "next/server";
import { isLimited, recordEvent } from "@/lib/rate-limit";
import { currentBuyerId, currentStaff } from "@/lib/v2/session";
import { transcribe, translateToEnglish } from "@/lib/v2/voice";

const MAX_BYTES = 3 * 1024 * 1024; // stays under the 4.5 MB request limit of serverless hosting
const ALLOWED = /^audio\/(webm|ogg|mp4|mpeg|mp3|wav|x-wav|m4a|x-m4a|flac)(;|$)/i;
const PER_10_MIN = 20;

// Turns a short voice recording into text. The audio is not stored: only the transcript the sender confirms is sent.
export async function POST(req: NextRequest) {
  const staff = await currentStaff();
  const identity = staff ? `staff:${staff.id}` : `buyer:${(await currentBuyerId()) ?? ""}`;
  if (identity === "buyer:") return NextResponse.json({ error: "Start a conversation first." }, { status: 401 });

  const key = `voice:${identity}`;
  if (await isLimited(key, PER_10_MIN, 10)) {
    return NextResponse.json({ error: "Too many voice messages in a short time. Please wait a few minutes or type your message." }, { status: 429 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("audio");
  if (!(file instanceof Blob) || file.size === 0) return NextResponse.json({ error: "No recording was received." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "The recording is too long. Please keep voice messages under one minute." }, { status: 413 });
  if (!ALLOWED.test(file.type)) return NextResponse.json({ error: "This audio format is not supported." }, { status: 415 });
  const hint = form?.get("language");
  const languageHint = typeof hint === "string" && /^[a-z]{2}$/.test(hint) ? hint : undefined;

  await recordEvent(key);
  try {
    const ext = file.type.includes("mp4") ? "m4a" : file.type.includes("ogg") ? "ogg" : file.type.includes("wav") ? "wav" : "webm";
    const result = await transcribe(file, `voice.${ext}`, languageHint);
    if (!result.text) return NextResponse.json({ error: "No speech was detected. Please try again and speak closer to the microphone." }, { status: 422 });
    // The English preview is a convenience: if it fails the transcript is still returned.
    const english = result.language === "en" ? result.text : await translateToEnglish(result.text).catch(() => null);
    return NextResponse.json({ text: result.text, language: result.language, english, provider: result.provider });
  } catch (err) {
    console.error("transcription failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Voice transcription is unavailable right now. You can type your message instead." }, { status: 502 });
  }
}
