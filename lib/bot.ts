import { sendDirectText } from "@/lib/nexconn-server";
import { SHOP_ID } from "@/lib/shop";

type WebhookMessage = {
  userId: string;
  channelId: string;
  channelType: number;
  messageType: string;
  content: string;
  os?: string;
};
export type WebhookEvent = { type: string; id: string; data: WebhookMessage[] };

const DIRECT_CHANNEL = 1;

// Best-effort duplicate guard inside one server instance; a database replaces it once we have one.
const seen = new Set<string>();

// Runs after the webhook has already been acknowledged, so it may take longer than Nexconn's 5s timeout.
export async function handleEvent(event: WebhookEvent) {
  if (event.type !== "message:send" || seen.has(event.id)) return;
  if (seen.size > 500) seen.clear();
  seen.add(event.id);

  for (const m of event.data) {
    if (m.channelType !== DIRECT_CHANNEL || m.channelId !== SHOP_ID) continue; // customer-to-shop chats only
    if (m.userId === SHOP_ID || m.os === "Server") continue; // never answer our own messages
    if (m.messageType !== "RC:TxtMsg") continue;

    const text = (JSON.parse(m.content) as { content?: string }).content ?? "";
    // Temporary echo to prove the webhook round trip; the Gemini reply replaces this next.
    await sendDirectText(SHOP_ID, m.userId, `Echo bot: ${text}`);
  }
}
