import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { isLimited, recordEvent } from "@/lib/rate-limit";
import { addSystemMessage, loadThreadView, notFound, requireBuyer } from "@/lib/v2/buyer-api";
import { hoursStatus, type WeekHours } from "@/lib/v2/hours";
import { notifyShop } from "@/lib/v2/notifications";
import { dispatch, logEvent } from "@/lib/v2/threads";

const HANDOFFS_PER_HOUR = 20;

type Params = { params: Promise<{ id: string }> };

// The buyer asks for the shop's people. Waiting or assigned conversations are returned as they are, so a double click is harmless.
export async function POST(_req: NextRequest, { params }: Params) {
  const auth = await requireBuyer();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const sql = db();

  const [t] = await sql`SELECT t.status, t.language, t.seller_id, s.response_target_min, s.business_hours, s.timezone
    FROM threads t JOIN sellers s ON s.id = t.seller_id WHERE t.id = ${id} AND t.buyer_id = ${auth.buyerId}`;
  if (!t) return notFound("Conversation");

  if (t.status === "ai" || t.status === "resolved") {
    const key = `handoff:${auth.buyerId}`;
    if (await isLimited(key, HANDOFFS_PER_HOUR, 60)) {
      return NextResponse.json({ error: "You have contacted the shop many times. Please try again later." }, { status: 429 });
    }
    const now = new Date();
    const status = hoursStatus(t.business_hours as WeekHours, t.timezone, now);
    const closed = status.configured && !status.openNow;
    // While the shop is closed the response-time clock starts at the next opening.
    const slaStart = closed && status.nextOpening ? status.nextOpening.at : now;
    const slaDueAt = new Date(slaStart.getTime() + t.response_target_min * 60_000);
    const claimed = await sql`UPDATE threads SET status = 'waiting', handoff_at = now(),
        sla_due_at = ${slaDueAt.toISOString()}::timestamptz, first_response_at = NULL, assigned_staff_id = NULL, resolved_at = NULL,
        summary = CASE WHEN ${t.status} = 'resolved' OR summary IS NULL THEN 'The buyer asked to speak with the shop.' ELSE summary END
      WHERE id = ${id} AND buyer_id = ${auth.buyerId} AND status = ${t.status} RETURNING id, summary, last_text`;
    if (claimed.length > 0) {
      await recordEvent(key);
      if (t.status === "resolved") await logEvent(id, "reopened", "buyer");
      await logEvent(id, "handoff", "buyer", { reason: "buyer_requested" });
      await notifyShop(t.seller_id, id, "handoff_requested", "A customer asked to speak with you", claimed[0].last_text || claimed[0].summary || "The buyer asked to speak with the shop.");
      const staffId = await dispatch(id, t.seller_id, t.language);
      const assigned = staffId ? (await loadThreadView(id, auth.buyerId))?.thread.assignedStaff : null;
      const reopens = closed && status.nextOpening ? ` The shop is closed now and reopens ${status.nextOpening.label} (${t.timezone}).` : "";
      await addSystemMessage(
        id,
        (assigned
          ? `${assigned.name} from the shop team has joined this conversation.`
          : "Your message has been passed to the shop and the owner has been notified. A reply will appear in this conversation. You may continue to add details while you wait.") + reopens,
      );
    }
  }

  const view = await loadThreadView(id, auth.buyerId);
  if (!view) return notFound("Conversation");
  return NextResponse.json(view);
}

// Cancels the request and returns the conversation to the AI assistant.
export async function DELETE(_req: NextRequest, { params }: Params) {
  const auth = await requireBuyer();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const cancelled = await db()`UPDATE threads SET status = 'ai', assigned_staff_id = NULL, handoff_at = NULL, sla_due_at = NULL, first_response_at = NULL, summary = NULL
    WHERE id = ${id} AND buyer_id = ${auth.buyerId} AND status IN ('waiting', 'assigned') RETURNING id`;
  if (cancelled.length > 0) {
    await logEvent(id, "handoff_cancelled", "buyer");
    await addSystemMessage(id, "Your request was cancelled. The assistant is answering again.");
  }
  const view = await loadThreadView(id, auth.buyerId);
  if (!view) return notFound("Conversation");
  return NextResponse.json(view);
}
