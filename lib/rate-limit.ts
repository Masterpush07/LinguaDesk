import { db } from "@/lib/db";

// Counts recent events per key in Neon, so a limit holds across every serverless instance (in-memory counters would not).

// Vercel sets x-real-ip to the visitor's address; the first x-forwarded-for entry is the fallback.
export function clientIp(headers: Headers): string {
  return headers.get("x-real-ip") ?? headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

// If the database check itself fails this answers "not limited", so a database hiccup never locks real users out.
export async function isLimited(key: string, limit: number, windowMinutes: number): Promise<boolean> {
  try {
    const [row] = await db()`SELECT count(*)::int AS n FROM rate_events
      WHERE key = ${key} AND created_at > now() - make_interval(mins => ${windowMinutes})`;
    return row.n >= limit;
  } catch (err) {
    console.error("rate limit check failed:", err instanceof Error ? err.message : err);
    return false;
  }
}

export async function recordEvent(key: string): Promise<void> {
  try {
    await db()`INSERT INTO rate_events (key) VALUES (${key})`;
    // Now and then drop old rows so the table stays tiny on the free database.
    if (Math.random() < 0.02) await db()`DELETE FROM rate_events WHERE created_at < now() - interval '1 day'`;
  } catch (err) {
    console.error("rate limit record failed:", err instanceof Error ? err.message : err);
  }
}
