// Server-only AI client. Order of attempts: Gemini lite, Gemini lite 2, Gemini 3.6 Flash, then Groq, because free tiers have limits.
// Free-tier daily limits (AI Studio): lite models 500 requests/day each, 3.6 Flash only 20. So lite goes first
// and the two lite quotas add up; the stronger model comes next, and Groq is the safety net when all of them fail.
import { groqJson } from "@/lib/groq";

const MODELS = ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-3.6-flash"];

// 429 is deliberately absent: an exhausted quota will not clear in a second, so go straight to the next model.
const RETRYABLE_STATUS = [500, 503];

async function geminiJson<T>(system: string, user: string, schema: object, models: string[]): Promise<T> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("Missing env var GEMINI_API_KEY");

  let lastError: unknown;
  for (const model of models) {
    // One quick retry per model: overload errors (503) are usually gone a moment later.
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
          method: "POST",
          headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: system }] },
            contents: [{ role: "user", parts: [{ text: user }] }],
            generationConfig: { responseMimeType: "application/json", responseSchema: schema, temperature: 0.2 },
          }),
          signal: AbortSignal.timeout(20_000),
          cache: "no-store",
        });
        if (!res.ok) {
          lastError = new Error(`Gemini ${model} returned HTTP ${res.status}`);
          if (attempt === 0 && RETRYABLE_STATUS.includes(res.status)) {
            await new Promise((resolve) => setTimeout(resolve, 800));
            continue;
          }
          break; // not worth retrying: move on to the next model
        }
        const body = await res.json();
        const text = body.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw new Error(`Gemini ${model} returned no text`);
        return JSON.parse(text) as T;
      } catch (err) {
        lastError = err;
        break;
      }
    }
  }
  throw lastError;
}

export async function generateJson<T>(
  system: string,
  user: string,
  schema: object,
  models: string[] = MODELS,
): Promise<T> {
  try {
    return await geminiJson<T>(system, user, schema, models);
  } catch (geminiError) {
    if (!process.env.GROQ_API_KEY) throw geminiError;
    console.warn("Gemini failed, falling back to Groq:", geminiError instanceof Error ? geminiError.message : geminiError);
    try {
      return await groqJson<T>(system, user, schema);
    } catch (groqError) {
      console.error("Groq fallback failed too:", groqError instanceof Error ? groqError.message : groqError);
      throw geminiError; // report the primary failure
    }
  }
}
