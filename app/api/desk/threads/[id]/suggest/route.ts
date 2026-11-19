import { NextResponse, type NextRequest } from "next/server";
import { suggestReply } from "@/lib/bot-ai";
import { db } from "@/lib/db";
import { onlyKnownNumbers } from "@/lib/number-check";
import { buildKnowledge } from "@/lib/shop-data";
import { requireStaff } from "@/lib/v2/guard";
import { fail, loadHead } from "@/lib/v2/desk-threads";
import { loadShop } from "@/lib/v2/shop";

type Ctx = { params: Promise<{ id: string }> };

const WHO = { buyer: "Customer", ai: "Shop (AI)", staff: "Shop (team)", system: "System" } as const;

// Drafts an English reply from the recent conversation. The agent reviews it before sending.
export async function POST(_req: NextRequest, ctx: Ctx) {
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;
  const { staff } = auth;
  const { id } = await ctx.params;
  const thread = await loadHead(staff, id);
  if (!thread) return fail(404, "Conversation not found.");

  const rows = await db()`SELECT sender, text, text_en FROM thread_messages WHERE thread_id = ${id} ORDER BY created_at DESC LIMIT 12`;
  if (rows.length === 0) return fail(404, "There are no messages to reply to yet.");
  const transcript = rows
    .reverse()
    .map((r) => `${WHO[r.sender as keyof typeof WHO] ?? "Other"}: ${r.text_en ?? r.text}`)
    .join("\n");

  try {
    const { shop, extra } = await loadShop(staff.sellerId);
    const kb = [buildKnowledge(shop), extra].filter(Boolean).join("\n\n");
    const draft = await suggestReply(transcript, kb, thread.summary);
    if (!draft) throw new Error("empty draft");
    const checked = onlyKnownNumbers(draft, kb, transcript);
    return NextResponse.json({ draft, note: checked ? undefined : "Check the numbers: some are not in the shop information." });
  } catch (err) {
    console.error("Desk suggestion failed:", err instanceof Error ? err.message : err);
    return fail(502, "A reply could not be drafted right now. Try again in a moment.");
  }
}
