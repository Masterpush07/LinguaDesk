import { db } from "@/lib/db";
import { CURRENCIES, FALLBACK_RATES } from "@/lib/platform/data";

// Server-only. Reference exchange rates from Frankfurter (free, no key, updated once a day), cached in the fx_rates row.
// They are only for showing prices: the shop always charges in US dollars.

export type FxRates = { base: "USD"; rates: Record<string, number>; updatedAt: string | null; source: "live" | "cached" | "fallback" };

const MAX_AGE_MS = 12 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 5000;
const QUOTES = CURRENCIES.filter((c) => c.code !== "USD").map((c) => c.code);

async function fetchLive(): Promise<Record<string, number> | null> {
  try {
    const res = await fetch(`https://api.frankfurter.dev/v2/rates?base=USD&quotes=${QUOTES.join(",")}`, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS), cache: "no-store" });
    if (!res.ok) return null;
    const rows: unknown = await res.json();
    if (!Array.isArray(rows)) return null;
    const rates: Record<string, number> = { USD: 1 };
    for (const row of rows as { quote?: unknown; rate?: unknown }[]) {
      if (typeof row?.quote === "string" && typeof row.rate === "number" && row.rate > 0 && QUOTES.includes(row.quote as (typeof QUOTES)[number])) rates[row.quote] = row.rate;
    }
    return QUOTES.every((q) => rates[q] !== undefined) ? rates : null;
  } catch {
    return null;
  }
}

export async function getRates(): Promise<FxRates> {
  const sql = db();
  let stored: { rates: Record<string, number>; fetchedAt: Date } | null = null;
  try {
    const [row] = await sql`SELECT rates, fetched_at FROM fx_rates WHERE id = 1`;
    if (row) stored = { rates: row.rates as Record<string, number>, fetchedAt: new Date(row.fetched_at) };
  } catch (err) {
    console.error("fx read failed:", err instanceof Error ? err.message : err);
  }

  if (stored && Date.now() - stored.fetchedAt.getTime() < MAX_AGE_MS) {
    return { base: "USD", rates: stored.rates, updatedAt: stored.fetchedAt.toISOString(), source: "cached" };
  }

  const live = await fetchLive();
  if (live) {
    const now = new Date();
    try {
      await sql`INSERT INTO fx_rates (id, rates, fetched_at) VALUES (1, ${JSON.stringify(live)}::jsonb, ${now.toISOString()})
        ON CONFLICT (id) DO UPDATE SET rates = EXCLUDED.rates, fetched_at = EXCLUDED.fetched_at`;
    } catch (err) {
      console.error("fx save failed:", err instanceof Error ? err.message : err);
    }
    return { base: "USD", rates: live, updatedAt: now.toISOString(), source: "live" };
  }

  if (stored) return { base: "USD", rates: stored.rates, updatedAt: stored.fetchedAt.toISOString(), source: "cached" };
  return { base: "USD", rates: { ...FALLBACK_RATES }, updatedAt: null, source: "fallback" };
}
