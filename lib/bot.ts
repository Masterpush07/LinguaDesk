import { generateReply, type BotReply } from "@/lib/bot-ai";
import { db } from "@/lib/db";
import { sendDirectText } from "@/lib/nexconn-server";
import { SHOP_ID } from "@/lib/shop";

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
const FALLBACK_ANSWER = "Thanks for your message! A team member will reply shortly.";

function textOf(m: WebhookMessage): string | null {
  if (m.messageType !== "RC:TxtMsg") return null;
  try {
    return (JSON.parse(m.content) as { content?: string }).content?.trim() || null;
  } catch {
    return null;
  }
}

// Runs after the webhook has already been acknowledged, so it may take longer than Nexconn's 5s timeout.
export async function handleEvent(event: WebhookEvent) {
  if (event.type !== "message:send") return;

  // Nexconn retries deliveries; only the first insert of an event ID gets to proceed.
  const claimed = await db()`INSERT INTO webhook_events (id) VALUES (${event.id}) ON CONFLICT DO NOTHING RETURNING id`;
  if (claimed.length === 0) return;

  for (const m of event.data) {
    if (m.channelType !== DIRECT_CHANNEL || m.os === "Server") continue; // server-sent messages are stored when we send them
    const text = textOf(m);
    if (!text) continue;
    if (m.userId === SHOP_ID) await recordOwnerMessage(m.channelId, m.messageId, text);
    else if (m.channelId === SHOP_ID) await answerCustomer(m.userId, m.messageId, text);
  }
}

async function touchConversation(customerId: string, text: string) {
  await db()`INSERT INTO conversations (customer_id, last_text, last_at) VALUES (${customerId}, ${text}, now())
    ON CONFLICT (customer_id) DO UPDATE SET last_text = ${text}, last_at = now()`;
}

async function recordOwnerMessage(customerId: string, messageId: string, text: string) {
  await touchConversation(customerId, text);
  await db()`INSERT INTO messages (id, customer_id, sender, text) VALUES (${messageId}, ${customerId}, 'owner', ${text}) ON CONFLICT DO NOTHING`;
}

async function answerCustomer(customerId: string, messageId: string, text: string) {
  const sql = db();
  await touchConversation(customerId, text);
  const [conversation] = await sql`SELECT status FROM conversations WHERE customer_id = ${customerId}`;

  // One AI call gives the answer, the English text for the owner and the handoff decision.
  let reply: BotReply | null = null;
  try {
    reply = await generateReply(text);
  } catch (err) {
    console.error("AI reply failed:", err instanceof Error ? err.message : err);
  }

  await sql`INSERT INTO messages (id, customer_id, sender, text, text_en)
    VALUES (${messageId}, ${customerId}, 'customer', ${text}, ${reply?.customer_text_en ?? null}) ON CONFLICT DO NOTHING`;
  if (reply) await sql`UPDATE conversations SET language = ${reply.customer_language} WHERE customer_id = ${customerId}`;

  if (conversation.status !== "ai") return; // a human owns this chat now, so the bot stays silent

  const needsHuman = reply?.needs_human ?? true; // if the AI is down, hand over instead of guessing
  if (needsHuman) {
    await sql`UPDATE conversations SET status = 'human', summary = ${reply?.owner_summary ?? text} WHERE customer_id = ${customerId}`;
  }

  const answer = reply?.answer ?? FALLBACK_ANSWER;
  const sent = await sendDirectText(SHOP_ID, customerId, answer, { ai: true });
  const aiMessageId = sent.messageIds?.[0]?.messageId ?? crypto.randomUUID();
  await sql`INSERT INTO messages (id, customer_id, sender, text) VALUES (${aiMessageId}, ${customerId}, 'ai', ${answer}) ON CONFLICT DO NOTHING`;
}
