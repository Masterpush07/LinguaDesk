import { connection, NextResponse, type NextRequest } from "next/server";
import { clientIp, isLimited, recordEvent } from "@/lib/rate-limit";
import { cleanParam } from "@/lib/v2/public-data";
import { getRates } from "@/lib/v2/fx";
import { loadContext, MAX_QUERY, runSearch, understand } from "@/lib/v2/smart-search";

const AI_SEARCHES_PER_10_MIN = 30;

// Public marketplace search for a sentence in any language, for example "a red scarf under $20 from India". The AI reads the sentence into filters;
// the results always come from the real catalogue. When the AI is busy the built-in parser answers instead, so this never fails because of the AI.
export async function GET(req: NextRequest) {
  await connection();
  const params = req.nextUrl.searchParams;
  const q = cleanParam(params.get("q"), MAX_QUERY);
  const category = cleanParam(params.get("category"));
  const country = cleanParam(params.get("country"));
  try {
    const ipKey = `nlsearch:${clientIp(req.headers)}`;
    const [rates, words, limited] = await Promise.all([getRates(), loadContext(), isLimited(ipKey, AI_SEARCHES_PER_10_MIN, 10)]);
    const ctx = { ...words, rates: rates.rates };
    const allowAI = q !== "" && !limited;
    const { intent, fromAI } = await understand(q, ctx, allowAI);
    if (fromAI) await recordEvent(ipKey);
    // Chips the shopper picked themselves narrow the sentence's own filters.
    const result = await runSearch({ ...intent, category: category || intent.category, country: country || intent.country });
    return NextResponse.json(result);
  } catch (err) {
    console.error("public search failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Search is unavailable right now. Please try again." }, { status: 500 });
  }
}
