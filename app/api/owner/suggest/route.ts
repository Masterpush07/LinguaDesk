import { NextResponse, type NextRequest } from "next/server";
import { suggestReply } from "@/lib/bot-ai";
import { db } from "@/lib/db";
import { onlyKnownNumbers } from "@/lib/number-check";
import { CUSTOMER_ID, isOwner } from "@/lib/owner-auth";
import { SHOP_KB } from "@/lib/shop-kb";

const WHO = { customer: "Customer", ai: "Shop (AI)", owner: "Shop (owner)" } as const;

// Drafts an English reply from the recent conversation. One AI call per click, and the owner reviews it before sending.
export async function POST(req: NextRequest) {
  if (!(await isOwner())) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { customerId?: unknown } | null;
  const customerId = typeof body?.customerId === "string" ? body.customerId : "";
  if (!CUSTOMER_ID.test(customerId)) return NextResponse.json({ error: "Bad request" }, { status: 400 });

  const rows = await db()`SELECT sender, text, text_en FROM messages WHERE customer_id = ${customerId}
    ORDER BY created_at DESC LIMIT 12`;
  if (rows.length === 0) return NextResponse.json({ error: "No messages to reply to yet" }, { status: 404 });

  // text_en holds the English version, so the model reads the owner's side and the translated customer side in English.
  const transcript = rows
    .reverse()
    .map((r) => `${WHO[r.sender as keyof typeof WHO] ?? "Other"}: ${r.text_en ?? r.text}`)
    .join("\n");

  try {
    const draft = await suggestReply(transcript);
    if (!draft) throw new Error("empty draft");
    const checked = onlyKnownNumbers(draft, SHOP_KB, transcript);
    return NextResponse.json({ draft, note: checked ? undefined : "Check the numbers: some are not in the shop info." });
  } catch (err) {
    console.error("Reply suggestion failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Could not draft a reply right now. Try again in a moment." }, { status: 502 });
  }
}
