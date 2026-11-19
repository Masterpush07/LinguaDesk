import { db } from "@/lib/db";
import type { Staff } from "@/lib/v2/session";
import type { ThreadHead } from "@/lib/v2/desk-types";
import { logEvent } from "@/lib/v2/threads";

// Server-only. Bookkeeping after a team member's message reaches the buyer (a reply or an order card).

// A conversation that was with the AI, waiting, or unassigned becomes this team member's; one already assigned keeps its assignee.
export async function recordStaffSend(staff: Staff, thread: ThreadHead, lastTextEn: string) {
  const takesOver = thread.status === "ai" || thread.status === "waiting" || !thread.assignedStaff;
  await db()`UPDATE threads SET last_text = ${lastTextEn}, last_at = now(),
      first_response_at = COALESCE(first_response_at, now()),
      status = CASE WHEN status IN ('ai', 'waiting') THEN 'assigned' ELSE status END,
      assigned_staff_id = CASE WHEN status IN ('ai', 'waiting') OR assigned_staff_id IS NULL THEN ${staff.id} ELSE assigned_staff_id END
    WHERE id = ${thread.id}`;
  if (takesOver) await logEvent(thread.id, "claimed", "staff", { staffId: staff.id, name: staff.name, via: "reply", from: thread.assignedStaff });
}
