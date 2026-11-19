import { after, NextResponse, type NextRequest } from "next/server";
import { handleEvent, type WebhookEvent } from "@/lib/bot";
import { verifyWebhook } from "@/lib/nexconn-server";
import { handleEventV2 } from "@/lib/v2/bot";

// Nexconn calls this for every chat event. It must answer 2xx within 5s or it retries and we would reply twice.
export async function POST(req: NextRequest) {
  if (!verifyWebhook(req.headers)) {
    return NextResponse.json({ error: "Bad signature" }, { status: 401 });
  }
  const event = (await req.json().catch(() => null)) as WebhookEvent | null;
  if (!event) return NextResponse.json({ error: "Bad body" }, { status: 400 });

  // The slow work (AI call, sending the reply) happens after the response has gone out.
  after(async () => {
    // The original demo shop and the registered sellers are handled independently, so one failing never blocks the other.
    for (const [label, handler] of [["demo shop", handleEvent], ["sellers", handleEventV2]] as const) {
      try {
        await handler(event);
      } catch (err) {
        console.error(`webhook handling failed (${label}):`, err instanceof Error ? err.message : err);
      }
    }
  });
  return NextResponse.json({ ok: true });
}
