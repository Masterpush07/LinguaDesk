import { after } from "next/server";
import { db } from "@/lib/db";
import type { Staff } from "@/lib/v2/session";
import type { ThreadHead } from "@/lib/v2/desk-types";
import { sendToBuyer } from "@/lib/v2/push";
import { logEvent } from "@/lib/v2/threads";

// Server-only. Bookkeeping after a team member's message reaches the buyer (a reply or an order card).

// The alert carries the text exactly as the buyer received it, in their language. It runs after the response so the agent never waits for it.
function alertBuyer(staff: Staff, thread: ThreadHead) {
  const run = async () => {
    try {
      const [row] = await db()`SELECT text FROM thread_messages WHERE thread_id = ${thread.id} AND sender = 'staff' ORDER BY created_at DESC LIMIT 1`;
      await sendToBuyer(thread.buyer.id, {
        title: `${staff.sellerName} replied`,
        body: typeof row?.text === "string" ? row.text : "You have a new message.",
        url: `/chat/${staff.sellerSlug}`,
        tag: `thread-${thread.id}`,
      });
    } catch (err) {
      console.error("buyer alert failed:", err instanceof Error ? err.message : err);
    }
  };
  try {
    after(run);
  } catch {
    void run();
  }
}

// A conversation that was with the AI, waiting, or unassigned becomes this team member's; one already assigned keeps its assignee.
export async function recordStaffSend(staff: Staff, thread: ThreadHead, lastTextEn: string) {
  const takesOver = thread.status === "ai" || thread.status === "waiting" || !thread.assignedStaff;
  await db()`UPDATE threads SET last_text = ${lastTextEn}, last_at = now(),
      first_response_at = COALESCE(first_response_at, now()),
      status = CASE WHEN status IN ('ai', 'waiting') THEN 'assigned' ELSE status END,
      assigned_staff_id = CASE WHEN status IN ('ai', 'waiting') OR assigned_staff_id IS NULL THEN ${staff.id} ELSE assigned_staff_id END
    WHERE id = ${thread.id}`;
  if (takesOver) await logEvent(thread.id, "claimed", "staff", { staffId: staff.id, name: staff.name, via: "reply", from: thread.assignedStaff });
  alertBuyer(staff, thread);
}
