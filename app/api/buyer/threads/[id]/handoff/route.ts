import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { isLimited, recordEvent } from "@/lib/rate-limit";
import { addSystemMessage, loadThreadView, notFound, requireBuyer } from "@/lib/v2/buyer-api";
import { dispatch, logEvent } from "@/lib/v2/threads";

const HANDOFFS_PER_HOUR = 20;

type Params = { params: Promise<{ id: string }> };

// The buyer asks for a human. Waiting or assigned conversations are returned as they are, so a double click is harmless.
export async function POST(_req: NextRequest, { params }: Params) {
  const auth = await requireBuyer();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const sql = db();

  const [t] = await sql`SELECT t.status, t.language, t.seller_id, s.response_target_min
    FROM threads t JOIN sellers s ON s.id = t.seller_id WHERE t.id = ${id} AND t.buyer_id = ${auth.buyerId}`;
  if (!t) return notFound("Conversation");

  if (t.status === "ai" || t.status === "resolved") {
    const key = `handoff:${auth.buyerId}`;
    if (await isLimited(key, HANDOFFS_PER_HOUR, 60)) {
      return NextResponse.json({ error: "You have requested an agent many times. Please try again later." }, { status: 429 });
    }
    const claimed = await sql`UPDATE threads SET status = 'waiting', handoff_at = now(),
        sla_due_at = now() + make_interval(mins => ${t.response_target_min}), first_response_at = NULL, assigned_staff_id = NULL, resolved_at = NULL,
        summary = CASE WHEN ${t.status} = 'resolved' OR summary IS NULL THEN 'The buyer asked to speak with an agent.' ELSE summary END
      WHERE id = ${id} AND buyer_id = ${auth.buyerId} AND status = ${t.status} RETURNING id`;
    if (claimed.length > 0) {
      await recordEvent(key);
      if (t.status === "resolved") await logEvent(id, "reopened", "buyer");
      await logEvent(id, "handoff", "buyer", { reason: "buyer_requested" });
      const staffId = await dispatch(id, t.seller_id, t.language);
      const assigned = staffId ? (await loadThreadView(id, auth.buyerId))?.thread.assignedStaff : null;
      await addSystemMessage(
        id,
        assigned
          ? `${assigned.name} from the shop team has joined this conversation.`
          : "Your request has been sent to the shop. A support agent will join as soon as one is available. You may continue to add details while you wait.",
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
    await addSystemMessage(id, "Your request was cancelled. The AI assistant is answering again.");
  }
  const view = await loadThreadView(id, auth.buyerId);
  if (!view) return notFound("Conversation");
  return NextResponse.json(view);
}
