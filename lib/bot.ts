import { generateReply, type BotReply, type HistoryItem } from "@/lib/bot-ai";
import { db } from "@/lib/db";
import { sendDirectText } from "@/lib/nexconn-server";
import { onlyKnownNumbers } from "@/lib/number-check";
import { SHOP_ID } from "@/lib/shop";
import { buildKnowledge } from "@/lib/shop-data";
import { getShop } from "@/lib/shop-store";

type WebhookMessage = {
  userId: string;
  channelId: string;
  channelType: number;
  messageType: string;
  messageId: string;
  content: string;
  os?: string;
};
export type WebhookEvent = { type: string; id: string; data: WebhookMessage[] };

const DIRECT_CHANNEL = 1;
const FALLBACK_ANSWER =
  "Thanks for your message! A team member will reply shortly.";
const OWNER_IDLE_MINUTES = 30; // after this long without an owner reply, the AI answers customers again

function textOf(m: WebhookMessage): string | null {
  if (m.messageType !== "RC:TxtMsg") return null;
  try {
    return (
      (JSON.parse(m.content) as { content?: string }).content?.trim() || null
    );
  } catch {
    return null;
  }
}

// Runs after the webhook has already been acknowledged, so it may take longer than Nexconn's 5s timeout.
export async function handleEvent(event: WebhookEvent) {
  if (event.type !== "message:send") return;

  // Nexconn retries deliveries; only the first insert of an event ID gets to proceed.
  const claimed =
    await db()`INSERT INTO webhook_events (id) VALUES (${event.id}) ON CONFLICT DO NOTHING RETURNING id`;
  if (claimed.length === 0) return;

  for (const m of event.data) {
    if (m.channelType !== DIRECT_CHANNEL || m.os === "Server") continue; // server-sent messages are stored when we send them
    const text = textOf(m);
    if (!text) continue;
    if (m.userId === SHOP_ID)
      await recordOwnerMessage(m.channelId, m.messageId, text);
    else if (m.channelId === SHOP_ID)
      await answerCustomer(m.userId, m.messageId, text);
  }
}

async function touchConversation(customerId: string, text: string) {
  await db()`INSERT INTO conversations (customer_id, last_text, last_at) VALUES (${customerId}, ${text}, now())
    ON CONFLICT (customer_id) DO UPDATE SET last_text = ${text}, last_at = now()`;
}

async function recordOwnerMessage(
  customerId: string,
  messageId: string,
  text: string,
) {
  await touchConversation(customerId, text);
  // The owner has joined, so from now on the bot stays out of this chat.
  await db()`UPDATE conversations SET status = 'human' WHERE customer_id = ${customerId}`;
  await db()`INSERT INTO messages (id, customer_id, sender, text) VALUES (${messageId}, ${customerId}, 'owner', ${text}) ON CONFLICT DO NOTHING`;
}

async function answerCustomer(
  customerId: string,
  messageId: string,
  text: string,
) {
  const sql = db();
  await touchConversation(customerId, text);
  const [conversation] = await sql`SELECT status,
    (SELECT (EXTRACT(EPOCH FROM now() - max(created_at)) / 60)::float8 FROM messages
      WHERE customer_id = ${customerId} AND sender = 'owner') AS owner_idle_min
    FROM conversations WHERE customer_id = ${customerId}`;

  // One AI call gives the answer, the English text for the owner and the handoff decision.
  const kb = buildKnowledge(await getShop());
  // The last few messages let the AI understand follow-ups like "and in blue?". The current message is not stored yet.
  const recent = await sql`SELECT sender, text, text_en FROM messages
    WHERE customer_id = ${customerId} ORDER BY created_at DESC LIMIT 8`;
  const history: HistoryItem[] = recent.reverse().map((r) => ({
    from:
      r.sender === "customer"
        ? "customer"
        : r.sender === "owner"
          ? "shop_owner"
          : "shop_ai",
    text: r.text_en ?? r.text,
  }));
  let reply: BotReply | null = null;
  try {
    reply = await generateReply(text, { kb, history });
  } catch (err) {
    console.error("AI reply failed:", err instanceof Error ? err.message : err);
  }

  // A price or date that is neither in the shop info, the customer's message nor something the shop already said never reaches the customer.
  const shopSaid = history
    .filter((h) => h.from !== "customer")
    .map((h) => h.text);
  if (reply && !onlyKnownNumbers(reply.answer, kb, text, ...shopSaid)) {
    console.error("AI answer blocked, unknown number:", reply.answer);
    reply = {
      ...reply,
      needs_human: true,
      answer: FALLBACK_ANSWER,
      owner_summary: `${reply.owner_summary} (The AI's draft answer was blocked: it contained a number not in the shop info.)`,
    };
  }

  await sql`INSERT INTO messages (id, customer_id, sender, text, text_en)
    VALUES (${messageId}, ${customerId}, 'customer', ${text}, ${reply?.customer_text_en ?? null}) ON CONFLICT DO NOTHING`;
  if (reply)
    await sql`UPDATE conversations SET language = ${reply.customer_language} WHERE customer_id = ${customerId}`;

  // While the owner is actively replying the bot stays silent; once they go quiet it takes over again.
  let status: string = conversation.status;
  if (status === "human") {
    const ownerIsActive =
      typeof conversation.owner_idle_min === "number" &&
      conversation.owner_idle_min < OWNER_IDLE_MINUTES;
    if (ownerIsActive) return;
    status = "ai";
    await sql`UPDATE conversations SET status = 'ai', summary = NULL WHERE customer_id = ${customerId}`;
  }

  const needsHuman = reply?.needs_human ?? true; // if the AI is down, hand over instead of guessing
  if (needsHuman && status === "ai") {
    // 'waiting' = owner was asked to step in; the bot keeps answering until the owner actually replies.
    await sql`UPDATE conversations SET status = 'waiting', summary = ${reply?.owner_summary ?? text} WHERE customer_id = ${customerId}`;
  }

  const answer = reply?.answer ?? FALLBACK_ANSWER;
  const sent = await sendDirectText(SHOP_ID, customerId, answer, { ai: true });
  const aiMessageId = sent.messageIds?.[0]?.messageId ?? crypto.randomUUID();
  await sql`INSERT INTO messages (id, customer_id, sender, text) VALUES (${aiMessageId}, ${customerId}, 'ai', ${answer}) ON CONFLICT DO NOTHING`;
}
