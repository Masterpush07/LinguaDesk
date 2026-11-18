// Server-only Groq client: the last-resort fallback when every Gemini model fails (daily quota, overload, outage).
// Groq's free tier needs no card. Each model has its own limits (1000 requests/day, 8000 tokens/minute), so two models double the headroom.
// Both gpt-oss models support strict JSON-schema output, like Gemini's response schema.
const GROQ_MODELS = ["openai/gpt-oss-120b", "openai/gpt-oss-20b"];

// Gemini schemas use upper-case types; Groq wants standard JSON Schema with no extra properties allowed.
function toJsonSchema(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(toJsonSchema);
  if (node && typeof node === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(node)) {
      out[key] = key === "type" && typeof value === "string" ? value.toLowerCase() : toJsonSchema(value);
    }
    if (out.type === "object") out.additionalProperties = false;
    return out;
  }
  return node;
}

export async function groqJson<T>(system: string, user: string, schema: object): Promise<T> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("Missing env var GROQ_API_KEY");
  const jsonSchema = toJsonSchema(schema);

  let lastError: unknown;
  for (const model of GROQ_MODELS) {
    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          temperature: 0.2,
          reasoning_effort: "low", // answers here are short, so deep reasoning would only add delay
          response_format: { type: "json_schema", json_schema: { name: "reply", strict: true, schema: jsonSchema } },
        }),
        signal: AbortSignal.timeout(25_000),
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`Groq ${model} returned HTTP ${res.status}`);
      const body = await res.json();
      const text = body.choices?.[0]?.message?.content;
      if (!text) throw new Error(`Groq ${model} returned no text`);
      return JSON.parse(text) as T;
    } catch (err) {
      lastError = err; // rate-limited or failed: try the next model
    }
  }
  throw lastError;
}
