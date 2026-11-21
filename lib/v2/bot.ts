import { generateReply, type BotReply, type HistoryItem, type Persona } from "@/lib/bot-ai";
import type { WebhookEvent } from "@/lib/bot";
import { db } from "@/lib/db";
import { sendDirectText } from "@/lib/nexconn-server";
import { onlyKnownNumbers } from "@/lib/number-check";
import { buildKnowledge } from "@/lib/shop-data";
import { newId } from "@/lib/v2/crypto";
import { notifyShop } from "@/lib/v2/notifications";
import { languageCode } from "@/lib/v2/voice";
import { assistantName, loadShop, sellerByNexconnId, type SellerRow } from "@/lib/v2/shop";
import { dispatch, logEvent, priorityFor, STAFF_SILENCE_MINUTES } from "@/lib/v2/threads";

const DIRECT_CHANNEL = 1;
const FALLBACK_ANSWER = "Thank you for your message. The shop team has been notified and will reply in this conversation.";
const TONES: Persona["tone"][] = ["formal", "neutral", "friendly"];

function textOf(content: string, messageType: string): string | null {
  if (messageType !== "RC:TxtMsg") return null;
  try {
    return (JSON.parse(content) as { content?: string }).content?.trim() || null;
  } catch {
    return null;
  }
}

// Runs after the webhook has been acknowledged. Routes each buyer message to the shop it was addressed to.
export async function handleEventV2(event: WebhookEvent) {
  if (event.type !== "message:send") return;
  const sql = db();
  // Separate prefix from the original bot, which claims the plain event ID.
  const claimed = await sql`INSERT INTO webhook_events (id) VALUES (${`v2:${event.id}`}) ON CONFLICT DO NOTHING RETURNING id`;
  if (claimed.length === 0) return;

  for (const m of event.data) {
    if (m.channelType !== DIRECT_CHANNEL || m.os === "Server") continue; // server-sent messages are stored when we send them
    const seller = await sellerByNexconnId(m.channelId);
    if (!seller) continue; // not addressed to a shop on this platform
    const text = textOf(m.content, m.messageType);
    if (!text) continue;
    await answerBuyer(seller, m.userId, m.messageId, text);
  }
}

// Makes sure the buyer and the conversation exist, then returns the thread row.
async function ensureThread(seller: SellerRow, buyerId: string) {
  const sql = db();
  await sql`INSERT INTO buyers (id) VALUES (${buyerId}) ON CONFLICT DO NOTHING`;
  const id = newId("thr");
  await sql`INSERT INTO threads (id, seller_id, buyer_id) VALUES (${id}, ${seller.id}, ${buyerId}) ON CONFLICT (seller_id, buyer_id) DO NOTHING`;
  const [thread] = await sql`SELECT t.*,
      (SELECT (EXTRACT(EPOCH FROM now() - max(created_at)) / 60)::float8 FROM thread_messages WHERE thread_id = t.id AND sender = 'staff') AS staff_idle_min
    FROM threads t WHERE t.seller_id = ${seller.id} AND t.buyer_id = ${buyerId}`;
  return thread;
}

async function answerBuyer(seller: SellerRow, buyerId: string, messageId: string, text: string) {
  const sql = db();
  const thread = await ensureThread(seller, buyerId);
  const threadId: string = thread.id;

  // A buyer writing to a closed conversation reopens it.
  if (thread.status === "resolved") {
    await sql`UPDATE threads SET status = 'ai', assigned_staff_id = NULL, resolved_at = NULL, summary = NULL WHERE id = ${threadId}`;
    await logEvent(threadId, "reopened", "buyer");
    thread.status = "ai";
  }

  const { shop, extra } = await loadShop(seller.id);
  const kb = [buildKnowledge(shop), extra].filter(Boolean).join("\n\n");
  const recent = await sql`SELECT sender, text, text_en FROM thread_messages WHERE thread_id = ${threadId} ORDER BY created_at DESC LIMIT 8`;
  const history: HistoryItem[] = recent.reverse().map((r) => ({
    from: r.sender === "buyer" ? "customer" : r.sender === "staff" ? "shop_owner" : "shop_ai",
    text: r.text_en ?? r.text,
  }));

  let reply: BotReply | null = null;
  try {
    const persona: Persona = {
      name: assistantName(seller.shop_name, seller.agent_name),
      shop: seller.shop_name,
      tone: TONES.find((t) => t === seller.tone) ?? "neutral",
    };
    reply = await generateReply(text, { kb, history, persona });
  } catch (err) {
    console.error("AI reply failed:", err instanceof Error ? err.message : err);
  }

  // A number that is neither in the shop info, the buyer's message nor something the shop already said never reaches the buyer.
  const shopSaid = history.filter((h) => h.from !== "customer").map((h) => h.text);
  if (reply && !onlyKnownNumbers(reply.answer, kb, text, ...shopSaid)) {
    console.error("AI answer blocked, unknown number:", reply.answer);
    reply = { ...reply, needs_human: true, answer: FALLBACK_ANSWER, owner_summary: `${reply.owner_summary} (The AI draft was blocked because it contained a number that is not in the shop information.)` };
  }

  await sql`INSERT INTO thread_messages (id, thread_id, sender, text, text_en, lang)
    VALUES (${messageId}, ${threadId}, 'buyer', ${text}, ${reply?.customer_text_en ?? null}, ${reply?.customer_language ?? null}) ON CONFLICT DO NOTHING`;
  await sql`UPDATE threads SET last_text = ${text}, last_at = now(), language = COALESCE(${reply?.customer_language ?? null}, language),
      subject = CASE WHEN subject = '' THEN ${text.slice(0, 80)} ELSE subject END WHERE id = ${threadId}`;

  // While a team member is actively replying the AI stays silent; once they go quiet it takes over again.
  if (thread.status === "assigned") {
    const staffActive = typeof thread.staff_idle_min === "number" && thread.staff_idle_min < STAFF_SILENCE_MINUTES;
    if (staffActive) return;
  }

  const needsHuman = reply?.needs_human ?? true; // if the AI is down, hand over instead of guessing
  if (needsHuman && (thread.status === "ai" || thread.status === "assigned")) {
    const priority = priorityFor(reply?.customer_text_en ?? text);
    // A thread whose staff went quiet goes back to the queue; a thread already waiting keeps its place and original SLA.
    await sql`UPDATE threads SET status = 'waiting', assigned_staff_id = NULL, summary = ${reply?.owner_summary ?? text}, priority = ${priority},
        handoff_at = now(), sla_due_at = now() + make_interval(mins => ${seller.response_target_min}), first_response_at = NULL WHERE id = ${threadId}`;
    await logEvent(threadId, "handoff", "ai", { reason: reply ? "ai_requested" : "ai_unavailable", priority });
    // The owner is told in the app whether or not a teammate is online to take it.
    await notifyShop(
      seller.id,
      threadId,
      "needs_reply",
      priority === "normal" ? "A customer needs your reply" : `A ${priority} question needs your reply`,
      reply?.owner_summary ?? text,
    );
    await dispatch(threadId, seller.id, languageCode(reply?.customer_language) ?? null);
  }

  const answer = reply?.answer ?? FALLBACK_ANSWER;
  const sent = await sendDirectText(seller.nexconn_user_id, buyerId, answer, { ai: true, metadata: needsHuman ? { handoff: "1" } : {} });
  const aiMessageId = sent.messageIds?.[0]?.messageId ?? newId("msg");
  await sql`INSERT INTO thread_messages (id, thread_id, sender, text, lang, numbers_verified)
    VALUES (${aiMessageId}, ${threadId}, 'ai', ${answer}, ${reply?.customer_language ?? null}, ${!!reply}) ON CONFLICT DO NOTHING`;
}
