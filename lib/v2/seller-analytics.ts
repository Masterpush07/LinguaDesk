import { db } from "@/lib/db";
import type { AnalyticsDto } from "@/lib/v2/seller-types";

// Same English-text keyword buckets as the original owner insights, so topics mean the same thing on both screens.
const TOPIC_RULES = {
  price: "price|cost|how much|dollar|cheap|discount",
  shipping: "ship|deliver|arrive|how long",
  returns: "return|refund|exchange|policy",
  payment: "pay|card|upi|cash",
  availability: "stock|available|colou?r|size|blue|red|green",
  ordering: "order|buy|purchase",
} as const;

const round1 = (n: unknown): number | null => (typeof n === "number" && Number.isFinite(n) ? Math.round(n * 10) / 10 : null);
const ratio = (part: number, whole: number): number | null => (whole === 0 ? null : part / whole);

// Everything is computed from stored rows for one shop. A figure with no data behind it is null, never zero or a guess.
export async function computeAnalytics(sellerId: string, days: number, tz: string): Promise<AnalyticsDto> {
  const sql = db();
  const [{ start }] = await sql`SELECT ((date_trunc('day', now() AT TIME ZONE ${tz}) - make_interval(days => ${days - 1})) AT TIME ZONE ${tz})::text AS start`;

  const [[threadStats], messageRows, daily, languages, [topicRow], agents, [orderStats]] = await Promise.all([
    sql`SELECT
      (SELECT count(*) FROM threads t WHERE t.seller_id = ${sellerId} AND EXISTS (
        SELECT 1 FROM thread_messages m WHERE m.thread_id = t.id AND m.sender = 'buyer' AND m.created_at >= ${start}::timestamptz))::int AS threads,
      (SELECT count(*) FROM threads t WHERE t.seller_id = ${sellerId} AND t.handoff_at >= ${start}::timestamptz AND EXISTS (
        SELECT 1 FROM thread_messages m WHERE m.thread_id = t.id AND m.sender = 'buyer' AND m.created_at >= ${start}::timestamptz))::int AS handoffs,
      (SELECT avg(EXTRACT(EPOCH FROM first_response_at - handoff_at) / 60)::float8 FROM threads
        WHERE seller_id = ${sellerId} AND first_response_at >= ${start}::timestamptz AND handoff_at IS NOT NULL AND first_response_at >= handoff_at) AS first_response,
      (SELECT avg(EXTRACT(EPOCH FROM resolved_at - handoff_at) / 60)::float8 FROM threads
        WHERE seller_id = ${sellerId} AND resolved_at >= ${start}::timestamptz AND handoff_at IS NOT NULL AND resolved_at >= handoff_at) AS resolution,
      (SELECT avg(rating)::float8 FROM threads WHERE seller_id = ${sellerId} AND resolved_at >= ${start}::timestamptz AND rating IS NOT NULL) AS rating,
      (SELECT count(*) FROM threads WHERE seller_id = ${sellerId} AND resolved_at >= ${start}::timestamptz AND rating IS NOT NULL)::int AS rating_count`,
    sql`SELECT m.sender, count(*)::int AS n FROM thread_messages m JOIN threads t ON t.id = m.thread_id
      WHERE t.seller_id = ${sellerId} AND m.created_at >= ${start}::timestamptz GROUP BY m.sender`,
    sql`SELECT to_char(d.day, 'YYYY-MM-DD') AS day, coalesce(x.threads, 0)::int AS threads, coalesce(x.messages, 0)::int AS messages
      FROM generate_series(date_trunc('day', now() AT TIME ZONE ${tz}) - make_interval(days => ${days - 1}), date_trunc('day', now() AT TIME ZONE ${tz}), interval '1 day') AS d(day)
      LEFT JOIN (
        SELECT date_trunc('day', m.created_at AT TIME ZONE ${tz}) AS day, count(DISTINCT m.thread_id) AS threads, count(*) AS messages
        FROM thread_messages m JOIN threads t ON t.id = m.thread_id
        WHERE t.seller_id = ${sellerId} AND m.sender = 'buyer' AND m.created_at >= ${start}::timestamptz GROUP BY 1
      ) x ON x.day = d.day ORDER BY d.day`,
    sql`SELECT t.language, count(*)::int AS n FROM threads t
      WHERE t.seller_id = ${sellerId} AND t.language IS NOT NULL AND EXISTS (
        SELECT 1 FROM thread_messages m WHERE m.thread_id = t.id AND m.sender = 'buyer' AND m.created_at >= ${start}::timestamptz)
      GROUP BY t.language ORDER BY n DESC, t.language LIMIT 8`,
    sql`SELECT
      count(*) FILTER (WHERE s.t ~* ${TOPIC_RULES.price})::int AS price,
      count(*) FILTER (WHERE s.t ~* ${TOPIC_RULES.shipping})::int AS shipping,
      count(*) FILTER (WHERE s.t ~* ${TOPIC_RULES.returns})::int AS returns,
      count(*) FILTER (WHERE s.t ~* ${TOPIC_RULES.payment})::int AS payment,
      count(*) FILTER (WHERE s.t ~* ${TOPIC_RULES.availability})::int AS availability,
      count(*) FILTER (WHERE s.t ~* ${TOPIC_RULES.ordering})::int AS ordering
      FROM (SELECT lower(coalesce(m.text_en, m.text)) AS t FROM thread_messages m JOIN threads th ON th.id = m.thread_id
        WHERE th.seller_id = ${sellerId} AND m.sender = 'buyer' AND m.created_at >= ${start}::timestamptz) s`,
    sql`SELECT st.id, st.name,
      (SELECT count(DISTINCT m.thread_id) FROM thread_messages m WHERE m.staff_id = st.id AND m.sender = 'staff' AND m.created_at >= ${start}::timestamptz)::int AS handled,
      (SELECT avg(EXTRACT(EPOCH FROM t.first_response_at - t.handoff_at) / 60)::float8 FROM threads t
        WHERE t.seller_id = ${sellerId} AND t.assigned_staff_id = st.id AND t.first_response_at >= ${start}::timestamptz
        AND t.handoff_at IS NOT NULL AND t.first_response_at >= t.handoff_at) AS first_response
      FROM staff st WHERE st.seller_id = ${sellerId} ORDER BY handled DESC, lower(st.name)`,
    sql`SELECT
      count(*) FILTER (WHERE created_at >= ${start}::timestamptz)::int AS proposed,
      count(*) FILTER (WHERE confirmed_at >= ${start}::timestamptz)::int AS confirmed,
      coalesce(sum(total) FILTER (WHERE status IN ('confirmed', 'packed', 'shipped', 'delivered') AND coalesce(confirmed_at, created_at) >= ${start}::timestamptz), 0)::float8 AS revenue
      FROM orders_v2 WHERE seller_id = ${sellerId}`,
  ]);

  const bySender = Object.fromEntries(messageRows.map((r) => [r.sender as string, r.n as number]));
  const handoffRate = ratio(threadStats.handoffs, threadStats.threads);

  return {
    days,
    totals: {
      threads: threadStats.threads,
      buyerMessages: bySender.buyer ?? 0,
      aiMessages: bySender.ai ?? 0,
      staffMessages: bySender.staff ?? 0,
      handoffRate: handoffRate === null ? null : Math.round(handoffRate * 1000) / 1000,
      aiResolvedPercent: handoffRate === null ? null : Math.round((1 - handoffRate) * 100),
      avgFirstResponseMinutes: round1(threadStats.first_response),
      avgResolutionMinutes: round1(threadStats.resolution),
      avgRating: threadStats.rating_count === 0 ? null : round1(threadStats.rating),
      ratingCount: threadStats.rating_count,
      revenueUsd: Math.round(orderStats.revenue),
    },
    daily: daily.map((d) => ({ day: d.day, threads: d.threads, buyerMessages: d.messages })),
    languages: languages.map((l) => ({ language: l.language, count: l.n })),
    topics: Object.keys(TOPIC_RULES)
      .map((topic) => ({ topic, count: (topicRow[topic] as number) ?? 0 }))
      .sort((a, b) => b.count - a.count),
    agents: agents.map((a) => ({ id: a.id, name: a.name, handled: a.handled, avgFirstResponseMinutes: round1(a.first_response) })),
    funnel: {
      conversations: threadStats.threads,
      handoffs: threadStats.handoffs,
      ordersProposed: orderStats.proposed,
      ordersConfirmed: orderStats.confirmed,
    },
  };
}
