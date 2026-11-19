import { NextResponse, type NextRequest } from "next/server";
import { generateReply } from "@/lib/bot-ai";
import { onlyKnownNumbers } from "@/lib/number-check";
import { isLimited, recordEvent } from "@/lib/rate-limit";
import { buildKnowledge } from "@/lib/shop-data";
import { requireStaff } from "@/lib/v2/guard";
import { fail, invalidBody, readJson } from "@/lib/v2/seller-api";
import type { GlossaryTestDto } from "@/lib/v2/seller-types";
import { loadShop } from "@/lib/v2/shop";

const FALLBACK = "Thank you for your message. A member of the team will reply shortly.";
const MAX_MESSAGE = 500;

// Runs the same AI reply a buyer would get, using this shop's products, FAQs, policies and glossary. Nothing is sent or stored.
export async function POST(req: NextRequest) {
  const auth = await requireStaff({ owner: true });
  if ("error" in auth) return auth.error;
  const body = await readJson(req);
  if (!body) return invalidBody();
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) return fail("Type a message to test.");
  if (message.length > MAX_MESSAGE) return fail(`The test message must be at most ${MAX_MESSAGE} characters.`);

  const key = `seller-ai-test:${auth.staff.id}`;
  if (await isLimited(key, 20, 10)) return fail("You have run many tests recently. Try again in a few minutes.", 429);
  await recordEvent(key);

  const { shop, extra } = await loadShop(auth.staff.sellerId);
  const kb = [buildKnowledge(shop), extra].filter(Boolean).join("\n\n");
  try {
    const reply = await generateReply(message, { kb });
    const blocked = !onlyKnownNumbers(reply.answer, kb, message);
    const result: GlossaryTestDto = {
      label: "Test reply. This was not sent to any customer.",
      reply: blocked ? FALLBACK : reply.answer,
      language: reply.customer_language,
      buyerMessageEnglish: reply.customer_text_en,
      needsAgent: blocked || reply.needs_human,
      blocked,
    };
    return NextResponse.json(result);
  } catch (err) {
    console.error("Glossary test failed:", err instanceof Error ? err.message : err);
    return fail("The AI assistant could not answer right now. Try again in a moment.", 502);
  }
}
