import { NextResponse, type NextRequest } from "next/server";
import { requireStaff } from "@/lib/v2/guard";
import { fail, loadHead, readBody } from "@/lib/v2/desk-threads";
import { buyerSample, renderForBuyer } from "@/lib/v2/desk-translate";
import type { PreviewResult } from "@/lib/v2/desk-types";

type Ctx = { params: Promise<{ id: string }> };

// What the buyer will read, plus an English back-translation so the agent can check it before sending.
export async function POST(req: NextRequest, ctx: Ctx) {
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;
  const { id } = await ctx.params;
  const body = await readBody(req);
  const text = typeof body?.text === "string" ? body.text.trim().slice(0, 1000) : "";
  if (!text) return fail(400, "Write a message first.");
  const thread = await loadHead(auth.staff, id);
  if (!thread) return fail(404, "Conversation not found.");

  try {
    const sample = await buyerSample(id);
    const rendered = await renderForBuyer(text, sample, true);
    const result: PreviewResult = {
      translated: rendered.translated,
      backTranslated: rendered.backTranslated,
      numbersOk: rendered.numbersOk,
      numbers: rendered.numbers,
      language: rendered.sameLanguage ? "English" : (thread.language ?? "the buyer's language"),
      sameLanguage: rendered.sameLanguage,
    };
    return NextResponse.json(result);
  } catch (err) {
    console.error("Desk preview failed:", err instanceof Error ? err.message : err);
    return fail(502, "Translation is unavailable right now.");
  }
}
