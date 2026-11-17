// Server-only Gemini client. Tries the main model, then a fallback, because free-tier limits can reject a request.
// Free-tier daily limits (AI Studio): lite models 500 requests/day each, 3.6 Flash only 20. So lite goes first
// and the two lite quotas add up; the stronger model is a last resort when both are exhausted.
const MODELS = ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-3.6-flash"];

const RETRYABLE_STATUS = [429, 500, 503];

export async function generateJson<T>(
  system: string,
  user: string,
  schema: object,
  models: string[] = MODELS,
): Promise<T> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("Missing env var GEMINI_API_KEY");

  let lastError: unknown;
  for (const model of models) {
    // One quick retry per model: overload errors (503, 429) are usually gone a moment later.
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
