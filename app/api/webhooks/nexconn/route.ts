import { after, NextResponse, type NextRequest } from "next/server";
import { handleEvent, type WebhookEvent } from "@/lib/bot";
import { verifyWebhook } from "@/lib/nexconn-server";

// Nexconn calls this for every chat event. It must answer 2xx within 5s or it retries and we would reply twice.
export async function POST(req: NextRequest) {
  if (!verifyWebhook(req.headers)) {
    return NextResponse.json({ error: "Bad signature" }, { status: 401 });
  }
  const event = (await req.json().catch(() => null)) as WebhookEvent | null;
  if (!event) return NextResponse.json({ error: "Bad body" }, { status: 400 });

  // The slow work (AI call, sending the reply) happens after the response has gone out.
  after(async () => {
    try {
      await handleEvent(event);
    } catch (err) {
      console.error("webhook handling failed:", err instanceof Error ? err.message : err);
    }
  });
  return NextResponse.json({ ok: true });
}
