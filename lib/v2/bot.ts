import { generateReply, type BotReply, type HistoryItem, type Persona } from "@/lib/bot-ai";
import type { WebhookEvent } from "@/lib/bot";
import { db } from "@/lib/db";
import { sendDirectText } from "@/lib/nexconn-server";
import { numberIssue, numbersPreserved } from "@/lib/number-check";
import { buildKnowledge } from "@/lib/shop-data";
import { newId } from "@/lib/v2/crypto";
import { hoursStatus, summarizeHours, type HoursStatus } from "@/lib/v2/hours";
import { notifyShop } from "@/lib/v2/notifications";
import { languageCode } from "@/lib/v2/voice";
import { assistantName, loadShop, sellerByNexconnId, type SellerRow } from "@/lib/v2/shop";
import { dispatch, logEvent, priorityFor, STAFF_SILENCE_MINUTES } from "@/lib/v2/threads";
import { AI_DEADLINE_MS, errorText, withDeadline } from "@/lib/v2/webhook-guard";

const DIRECT_CHANNEL = 1;
const MAX_BUYER_MESSAGES_PER_10_MIN = 30; // a buyer can message through the Nexconn SDK directly, which skips the HTTP rate limits
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
// Duplicates are caught per message (the stored message ID), not per event, so a crash before a message is stored never blocks a retry.
export async function handleEventV2(event: WebhookEvent) {
  if (event.type !== "message:send") return;
  for (const m of event.data) {
    try {
      if (!m || m.channelType !== DIRECT_CHANNEL || m.os === "Server") continue; // server-sent messages are stored when we send them
      const seller = await sellerByNexconnId(m.channelId);
      if (!seller) continue; // not addressed to a shop on this platform
      const text = textOf(m.content, m.messageType);
      if (!text) continue;
      await answerBuyer(seller, m.userId, m.messageId, text);
    } catch (err) {
      // One bad message must not drop the rest of the batch.
      console.error(`buyer message failed event=${event.id} message=${m?.messageId}:`, errorText(err));
    }
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

function buildHoursNote(seller: SellerRow, hours: HoursStatus): string {
  const base = `Shop hours: ${summarizeHours(seller.business_hours ?? {})} ${seller.timezone}.`;
  if (hours.openNow) return `${base} The shop is open now. If the customer asks when someone will reply, say a team member will reply as soon as possible.`;
  const reopens = hours.nextOpening ? ` and reopens ${hours.nextOpening.label}` : "";
  return `${base} The shop is currently closed${reopens}. If the customer asks when someone will reply, say this.`;
}

// Tells the assistant which product the customer is looking at and what they picked on the product page.
async function threadContext(thread: Record<string, unknown>, sellerId: string): Promise<string> {
  if (typeof thread.product_id !== "string") return "";
  const [p] = await db()`SELECT name FROM products WHERE id = ${thread.product_id} AND seller_id = ${sellerId}`;
  if (!p) return "";
  const sel = thread.selection && typeof thread.selection === "object" ? (thread.selection as Record<string, unknown>) : {};
  const picked = [
    typeof sel.colour === "string" && sel.colour ? `selected colour ${sel.colour.slice(0, 40)}` : "",
    typeof sel.size === "string" && sel.size ? `selected size ${sel.size.slice(0, 40)}` : "",
    typeof sel.qty === "number" && Number.isFinite(sel.qty) ? `quantity ${sel.qty}` : "",
  ].filter(Boolean);
  return `Context: the customer is asking about the product '${String(p.name).slice(0, 80)}'${picked.length ? ` (${picked.join(", ")})` : ""}.`;
}

type Progress = { answered: boolean };

async function answerBuyer(seller: SellerRow, buyerId: string, messageId: string, text: string) {
  const sql = db();
  const thread = await ensureThread(seller, buyerId);
  const threadId: string = thread.id;
  const recent = await sql`SELECT sender, text, text_en FROM thread_messages WHERE thread_id = ${threadId} ORDER BY created_at DESC LIMIT 8`;

  // The message is stored before anything slow runs: it can no longer be lost, and a second delivery of it stops here.
  const stored = await sql`INSERT INTO thread_messages (id, thread_id, sender, text) VALUES (${messageId}, ${threadId}, 'buyer', ${text}) ON CONFLICT DO NOTHING RETURNING id`;
  if (stored.length === 0) {
    console.warn(`duplicate buyer message ignored message=${messageId} thread=${threadId}`);
    return;
  }

  const progress: Progress = { answered: false };
  const [{ n: recentCount }] = await sql`SELECT count(*)::int AS n FROM thread_messages
    WHERE thread_id = ${threadId} AND sender = 'buyer' AND created_at > now() - interval '10 minutes'`;
  if (recentCount > MAX_BUYER_MESSAGES_PER_10_MIN) {
    // Kept for the team to read, but it costs no AI call, notification or reply.
    console.warn(`buyer message flood: stored without AI reply message=${messageId} thread=${threadId} count=${recentCount}`);
    return;
  }
  try {
    await respond(seller, buyerId, messageId, text, thread, recent, progress);
  } catch (err) {
    console.error(`buyer message processing failed message=${messageId} thread=${threadId}:`, errorText(err));
    await recover(seller, buyerId, threadId, text, progress);
  }
}

// Last resort after an unexpected failure: put the thread in front of the team and tell the buyer someone will reply, so it is never left silent.
async function recover(seller: SellerRow, buyerId: string, threadId: string, text: string, progress: Progress) {
  const sql = db();
  try {
    const now = new Date();
    const hours = hoursStatus(seller.business_hours, seller.timezone, now);
    const moved = await sql`UPDATE threads SET status = 'waiting', assigned_staff_id = NULL, summary = ${text}, priority = ${priorityFor(text)},
        handoff_at = now(), sla_due_at = ${slaDue(seller, hours, now).toISOString()}::timestamptz, first_response_at = NULL
      WHERE id = ${threadId} AND status IN ('ai', 'resolved') RETURNING id`;
    if (moved.length > 0) {
      await logEvent(threadId, "handoff", "ai", { reason: "processing_error" });
      await notifyShop(seller.id, threadId, "needs_reply", "A customer needs your reply", text);
      await dispatch(threadId, seller.id, null);
    }
  } catch (err) {
    console.error(`recovery hand-over failed thread=${threadId}:`, errorText(err));
  }
  if (progress.answered) return;
  await deliverAnswer(seller, buyerId, threadId, FALLBACK_ANSWER, null, true, false).catch((err) => console.error(`fallback reply failed thread=${threadId}:`, errorText(err)));
}

// While the shop is closed the response-time clock starts at the next opening.
function slaDue(seller: SellerRow, hours: HoursStatus, now: Date): Date {
  const start = hours.configured && !hours.openNow && hours.nextOpening ? hours.nextOpening.at : now;
  return new Date(start.getTime() + seller.response_target_min * 60_000);
}

// The buyer's view reads the database, so the answer is stored even when Nexconn cannot deliver it right now.
async function deliverAnswer(seller: SellerRow, buyerId: string, threadId: string, answer: string, language: string | null, needsHuman: boolean, verified: boolean) {
  let aiMessageId: string;
  try {
    const sent = await sendDirectText(seller.nexconn_user_id, buyerId, answer, { ai: true, metadata: needsHuman ? { handoff: "1" } : {} });
    aiMessageId = sent.messageIds?.[0]?.messageId ?? newId("msg");
  } catch (err) {
    console.error(`reply not delivered through Nexconn, stored for the buyer's view thread=${threadId}:`, errorText(err));
    aiMessageId = newId("msg");
  }
  await db()`INSERT INTO thread_messages (id, thread_id, sender, text, lang, numbers_verified)
    VALUES (${aiMessageId}, ${threadId}, 'ai', ${answer}, ${language}, ${verified}) ON CONFLICT DO NOTHING`;
}

async function respond(seller: SellerRow, buyerId: string, messageId: string, text: string, thread: Record<string, unknown>, recent: Record<string, unknown>[], progress: Progress) {
  const sql = db();
  const threadId = thread.id as string;
  await sql`UPDATE threads SET last_text = ${text}, last_at = now(), subject = CASE WHEN subject = '' THEN ${text.slice(0, 80)} ELSE subject END WHERE id = ${threadId}`;

  // A buyer writing to a closed conversation reopens it.
  if (thread.status === "resolved") {
    await sql`UPDATE threads SET status = 'ai', assigned_staff_id = NULL, resolved_at = NULL, summary = NULL WHERE id = ${threadId}`;
    await logEvent(threadId, "reopened", "buyer");
    thread.status = "ai";
  }

  const { shop, extra } = await loadShop(seller.id);
  const now = new Date();
  const hours = hoursStatus(seller.business_hours, seller.timezone, now);
  const hoursNote = hours.configured ? buildHoursNote(seller, hours) : undefined;
  const kb = [buildKnowledge(shop), extra, await threadContext(thread, seller.id)].filter(Boolean).join("\n\n");
  const history: HistoryItem[] = [...recent].reverse().map((r) => ({
    from: r.sender === "buyer" ? "customer" : r.sender === "staff" ? "shop_owner" : "shop_ai",
    text: (r.text_en ?? r.text) as string,
  }));

  let reply: BotReply | null = null;
  try {
    const persona: Persona = {
      name: assistantName(seller.shop_name, seller.agent_name),
      shop: seller.shop_name,
      tone: TONES.find((t) => t === seller.tone) ?? "neutral",
      hoursNote,
    };
    reply = await withDeadline(generateReply(text, { kb, history, persona }), AI_DEADLINE_MS, "AI reply");
  } catch (err) {
    console.error(`AI reply failed message=${messageId} thread=${threadId}:`, errorText(err));
  }

  // A number, price or quantity that is neither in the shop info, the buyer's message nor something the shop already said never reaches the buyer.
  const shopSaid = history.filter((h) => h.from !== "customer").map((h) => h.text);
  const issue = reply ? numberIssue(reply.answer, kb, text, hoursNote ?? "", ...shopSaid) : null;
  const summaryUnchecked = reply ? numberIssue(reply.owner_summary, kb, text) !== null : false;
  if (reply && issue) {
    console.error(`AI answer blocked (${issue}):`, reply.answer);
    reply = { ...reply, needs_human: true, answer: FALLBACK_ANSWER, owner_summary: `${reply.owner_summary} (The AI draft was blocked because ${issue}. A team member should answer.)` };
  }
  if (reply && !numbersPreserved(text, reply.customer_text_en)) {
    // The English reading of the buyer's message changed a number, so the AI may have misread it too: a person must check the original.
    console.warn(`English translation changed a number message=${messageId}`);
    reply = { ...reply, needs_human: true, owner_summary: `${reply.owner_summary} (The English translation of the customer's message changed a number. Read the original message before quoting a price or quantity.)` };
  } else if (reply && summaryUnchecked) {
    reply = { ...reply, owner_summary: `${reply.owner_summary} (A number in this summary could not be checked against the message. Read the original.)` };
  }

  await sql`UPDATE thread_messages SET text_en = ${reply?.customer_text_en ?? null}, lang = ${reply?.customer_language ?? null} WHERE id = ${messageId}`;
  await sql`UPDATE threads SET language = COALESCE(${reply?.customer_language ?? null}, language) WHERE id = ${threadId}`;

  // While a team member is actively replying the AI stays silent; once they go quiet it takes over again.
  if (thread.status === "assigned") {
    const staffActive = typeof thread.staff_idle_min === "number" && thread.staff_idle_min < STAFF_SILENCE_MINUTES;
    if (staffActive) return;
  }

  const needsHuman = reply?.needs_human ?? true; // if the AI is down, hand over instead of guessing
  if (needsHuman && (thread.status === "ai" || thread.status === "assigned")) {
    const priority = priorityFor(reply?.customer_text_en ?? text);
    // A thread whose staff went quiet goes back to the queue; a thread already waiting keeps its place and original SLA.
    const slaDueAt = slaDue(seller, hours, now);
    await sql`UPDATE threads SET status = 'waiting', assigned_staff_id = NULL, summary = ${reply?.owner_summary ?? text}, priority = ${priority},
        handoff_at = now(), sla_due_at = ${slaDueAt.toISOString()}::timestamptz, first_response_at = NULL WHERE id = ${threadId}`;
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

  progress.answered = true; // from here a failure must not send a second reply
  await deliverAnswer(seller, buyerId, threadId, reply?.answer ?? FALLBACK_ANSWER, reply?.customer_language ?? null, needsHuman, !!reply);
}
