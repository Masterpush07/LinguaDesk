import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isOwner } from "@/lib/owner-auth";

// Keyword buckets run on the English text, so one simple rule set covers every customer language.
const TOPIC_RULES = {
  price: "price|cost|how much|dollar|cheap|discount",
  shipping: "ship|deliver|arrive|how long",
  returns: "return|refund|exchange|policy",
  payment: "pay|card|upi|cash",
  availability: "stock|available|colou?r|size|blue|red|green",
  ordering: "order|buy|purchase",
} as const;

// Owner-only numbers for the Insights page. Plain read-only queries, no AI calls, so opening it costs no quota.
export async function GET() {
  if (!(await isOwner())) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const sql = db();

  const [totals, languages, daily, topics] = await Promise.all([
    sql`SELECT
      (SELECT count(*) FROM conversations)::int AS customers,
      (SELECT count(*) FROM messages WHERE sender = 'customer')::int AS customer_messages,
      (SELECT count(*) FROM messages WHERE sender = 'ai')::int AS ai_replies,
      (SELECT count(*) FROM messages WHERE sender = 'owner')::int AS owner_replies,
      (SELECT count(*) FROM messages WHERE sender = 'customer' AND text_en IS NOT NULL AND text_en <> text)::int AS translated,
      (SELECT count(*) FROM conversations WHERE status = 'waiting')::int AS waiting_now,
      (SELECT count(*) FROM conversations c WHERE c.status <> 'waiting'
        AND NOT EXISTS (SELECT 1 FROM messages m WHERE m.customer_id = c.customer_id AND m.sender = 'owner'))::int AS ai_only`,
    sql`SELECT language, count(*)::int AS n FROM conversations
      WHERE language IS NOT NULL GROUP BY language ORDER BY n DESC LIMIT 12`,
    sql`SELECT to_char(day, 'Mon DD') AS label, coalesce(x.n, 0)::int AS n
      FROM generate_series(current_date - 6, current_date, interval '1 day') AS day
      LEFT JOIN (SELECT created_at::date AS d, count(*) AS n FROM messages
        WHERE sender = 'customer' AND created_at >= current_date - 6 GROUP BY 1) x ON x.d = day::date
      ORDER BY day`,
    sql`SELECT
      count(*) FILTER (WHERE t ~* ${TOPIC_RULES.price})::int AS price,
      count(*) FILTER (WHERE t ~* ${TOPIC_RULES.shipping})::int AS shipping,
      count(*) FILTER (WHERE t ~* ${TOPIC_RULES.returns})::int AS returns,
      count(*) FILTER (WHERE t ~* ${TOPIC_RULES.payment})::int AS payment,
      count(*) FILTER (WHERE t ~* ${TOPIC_RULES.availability})::int AS availability,
      count(*) FILTER (WHERE t ~* ${TOPIC_RULES.ordering})::int AS ordering
      FROM (SELECT lower(coalesce(text_en, text)) AS t FROM messages WHERE sender = 'customer') s`,
  ]);

  return NextResponse.json({ totals: totals[0], languages, daily, topics: topics[0] });
}
