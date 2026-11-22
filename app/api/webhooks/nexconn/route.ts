import { after, NextResponse, type NextRequest } from "next/server";
import { handleEvent } from "@/lib/bot";
import { legacyEnabled } from "@/lib/legacy";
import { verifyWebhook } from "@/lib/nexconn-server";
import { handleEventV2 } from "@/lib/v2/bot";
import { errorText, isWebhookEvent, MAX_WEBHOOK_BYTES } from "@/lib/v2/webhook-guard";

// after() runs inside this limit, so it also bounds the AI call and the reply that follow the acknowledgement.
export const maxDuration = 60;

// Nexconn calls this for every chat event. It must answer 2xx within 5s or it retries.
export async function POST(req: NextRequest) {
  let verified: boolean;
  try {
    verified = verifyWebhook(req.headers);
  } catch (err) {
    console.error("webhook cannot be verified:", errorText(err)); // e.g. the app secret is missing: a 5xx makes Nexconn retry later
    return NextResponse.json({ error: "Webhook is not configured" }, { status: 500 });
  }
  if (!verified) {
    console.warn("webhook rejected: bad or stale signature");
    return NextResponse.json({ error: "Bad signature" }, { status: 401 });
  }
  const raw = await req.text();
  if (raw.length > MAX_WEBHOOK_BYTES) return NextResponse.json({ error: "Body too large" }, { status: 413 });
  let event: unknown = null;
  try {
    event = JSON.parse(raw);
  } catch {
    // rejected below
  }
  if (!isWebhookEvent(event)) {
    console.warn("webhook rejected: unexpected body shape");
    return NextResponse.json({ error: "Bad body" }, { status: 400 });
  }

  // The slow work (AI call, sending the reply) happens after the response has gone out.
  after(async () => {
    // The original demo shop and the registered sellers are handled independently, so one failing never blocks the other.
    for (const [label, handler] of [["demo shop", handleEvent], ["sellers", handleEventV2]] as const) {
      if (label === "demo shop" && !legacyEnabled()) continue; // retired single-shop bot
      try {
        await handler(event);
      } catch (err) {
        console.error(`webhook handling failed (${label}) event=${event.id}:`, errorText(err));
      }
    }
  });
  return NextResponse.json({ ok: true });
}
