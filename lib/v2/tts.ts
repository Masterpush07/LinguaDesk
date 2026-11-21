// Server-only. Text-to-speech through Gemini's TTS models (free tier). The browser's own voices are tried first; this is for devices that have none
// for the buyer's language (Tamil, for example, is often missing). It reads aloud only text that is already in a conversation.
const MODELS = ["gemini-3.8-flash-lite-tts", "gemini-3.8-flash-tts"];
const VOICE = "Kore";
const TIMEOUT_MS = 25_000;

export const TTS_MAX_CHARS = 600;
export type Speech = { mime: string; bytes: Buffer };

// Some models return raw 16-bit PCM; browsers need a WAV header to play it.
function pcmToWav(pcm: Buffer, rate: number): Buffer {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

export async function synthesize(text: string): Promise<Speech> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("Missing env var GEMINI_API_KEY");
  const clipped = text.slice(0, TTS_MAX_CHARS);

  let lastError: unknown;
  for (const model of MODELS) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: clipped }] }],
          generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE } } } },
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`Gemini ${model} returned HTTP ${res.status}`);
      const body = await res.json();
      const part = body.candidates?.[0]?.content?.parts?.[0]?.inlineData as { mimeType?: string; data?: string } | undefined;
      if (!part?.data) throw new Error(`Gemini ${model} returned no audio`);
      const raw = Buffer.from(part.data, "base64");
      const mime = (part.mimeType ?? "").toLowerCase();
      if (mime.includes("wav")) return { mime: "audio/wav", bytes: raw };
      const rate = Number(/rate=(\d+)/.exec(mime)?.[1] ?? 24000);
      return { mime: "audio/wav", bytes: pcmToWav(raw, rate) };
    } catch (err) {
      lastError = err; // quota or overload: try the next model
    }
  }
  throw lastError;
}
