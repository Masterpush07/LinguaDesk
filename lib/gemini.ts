// Server-only Gemini client. Tries the main model, then a fallback, because free-tier limits can reject a request.
// Best quality first; the lite models take over when the free quota or an outage rejects a call.
const MODELS = ["gemini-3.6-flash", "gemini-3.5-flash-lite", "gemini-3.1-flash-lite"];

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
      if (!res.ok) throw new Error(`Gemini ${model} returned HTTP ${res.status}`);
      const body = await res.json();
      const text = body.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error(`Gemini ${model} returned no text`);
      return JSON.parse(text) as T;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}
