import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { beforeEach, describe, it } from "node:test";
import { NextRequest } from "next/server";
import { POST as webhookRoute } from "@/app/api/webhooks/nexconn/route";
import { db } from "@/lib/db";
import { handleEventV2 } from "@/lib/v2/bot";
import { isWebhookEvent, withDeadline } from "@/lib/v2/webhook-guard";
import type { WebhookEvent } from "@/lib/bot";
import { addShop, resetShops } from "./support/fixtures";

process.env.NEXCONN_APP_SECRET = "test-only";
process.env.NEXT_PUBLIC_NEXCONN_APP_KEY = "test-only";
process.env.GEMINI_API_KEY = "test-only";
delete process.env.GROQ_API_KEY;

// Gemini and Nexconn are answered locally; anything else is refused.
type Ai = "ok" | "down" | "broken";
const net = { ai: "ok" as Ai, nexconnDown: false, sends: 0 };
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL) => {
  const url = String(input instanceof Request ? input.url : input);
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  if (/generativelanguage\.googleapis\.com/.test(url)) {
    if (net.ai === "down") return json({ error: "down" }, 400);
    const reply = net.ai === "ok"
      ? { customer_language: "English", customer_text_en: "Do you ship?", answer: "Yes, we ship.", needs_human: false, owner_summary: "Asked about shipping" }
      : { customer_language: "English", customer_text_en: "Do you ship?", answer: null, needs_human: true, owner_summary: "x" };
    return json({ candidates: [{ content: { parts: [{ text: JSON.stringify(reply) }] } }] });
  }
  if (/sg-light-api\.com/.test(url)) {
    net.sends++;
    return net.nexconnDown ? json({}, 500) : json({ code: 0, result: { messageIds: [{ userId: "x", messageId: `srv-${net.sends}` }] } });
  }
  throw new Error(`tests may not reach the network: ${url}`);
}) as typeof fetch;
process.on("exit", () => void (globalThis.fetch = realFetch));

let nexconnId = "";
const event = (messageId: string, id = `evt-${messageId}`, text = "Do you ship?"): WebhookEvent => ({
  type: "message:send",
  id,
  data: [{ userId: "buyer1", channelId: nexconnId, channelType: 1, messageType: "RC:TxtMsg", messageId, content: JSON.stringify({ content: text }) }],
});
const rows = async (sender: string) => db()`SELECT id, text, text_en FROM thread_messages WHERE sender = ${sender}`;
const thread = async () => (await db()`SELECT status, summary, language FROM threads`)[0];
const handoffReasons = async () => (await db()`SELECT payload FROM thread_events WHERE type = 'handoff'`).map((r) => (r.payload as { reason: string }).reason);

describe("buyer messages through the webhook handler", () => {
  beforeEach(async () => {
    await resetShops();
    Object.assign(net, { ai: "ok", nexconnDown: false, sends: 0 });
    const { sellerId } = await addShop({ slug: "hook-shop", name: "Hook Shop", staff: [{ name: "Owner" }] });
    nexconnId = (await db()`SELECT nexconn_user_id FROM sellers WHERE id = ${sellerId}`)[0].nexconn_user_id as string;
  });

  it("stores the message and the AI answer", async () => {
    await handleEventV2(event("m1"));
    assert.deepEqual((await rows("buyer")).map((r) => [r.id, r.text_en]), [["m1", "Do you ship?"]]);
    assert.deepEqual((await rows("ai")).map((r) => r.text), ["Yes, we ship."]);
    assert.equal((await thread()).status, "ai");
    assert.equal((await thread()).language, "English");
  });

  it("a repeated delivery, under the same or a new event ID, is answered once", async () => {
    await handleEventV2(event("m1"));
    await handleEventV2(event("m1"));
    await handleEventV2(event("m1", "another-event-id"));
    assert.equal((await rows("buyer")).length, 1);
    assert.equal((await rows("ai")).length, 1);
    assert.equal(net.sends, 1);
  });

  it("two different messages in one event are both handled, even with a malformed item before them", async () => {
    const a = event("m1");
    const b = event("m2");
    await handleEventV2({ ...a, data: [null as never, a.data[0], b.data[0]] });
    assert.equal((await rows("buyer")).length, 2);
    assert.equal((await rows("ai")).length, 2);
  });

  it("when the AI is down the message is kept, the thread goes to the team and the buyer gets a holding reply", async () => {
    net.ai = "down";
    await handleEventV2(event("m1"));
    assert.equal((await rows("buyer")).length, 1);
    const t = await thread();
    assert.equal(t.status, "waiting");
    assert.equal(t.summary, "Do you ship?");
    assert.deepEqual(await handoffReasons(), ["ai_unavailable"]);
    assert.match((await rows("ai"))[0].text as string, /shop team has been notified/);
  });

  it("when Nexconn cannot deliver the answer it is still stored, and nothing throws", async () => {
    net.nexconnDown = true;
    await handleEventV2(event("m1"));
    assert.equal((await rows("ai")).length, 1);
  });

  it("an unexpected failure while handling keeps the message, hands over once and sends one holding reply", async () => {
    net.ai = "broken"; // the AI returns a null answer, which the handler does not expect
    await handleEventV2(event("m1"));
    assert.equal((await rows("buyer")).length, 1);
    assert.equal((await thread()).status, "waiting");
    assert.deepEqual(await handoffReasons(), ["processing_error"]);
    assert.equal((await rows("ai")).length, 1);
    assert.equal(net.sends, 1);
  });

  it("a buyer flooding a shop through the SDK is stored but costs no AI call or reply", async () => {
    await handleEventV2(event("m0"));
    const [t] = await db()`SELECT id FROM threads`;
    for (let i = 0; i < 35; i++) await db()`INSERT INTO thread_messages (id, thread_id, sender, text) VALUES (${`flood-${i}`}, ${t.id as string}, 'buyer', 'spam')`;
    const sendsBefore = net.sends;
    await handleEventV2(event("m-flood"));
    assert.equal((await rows("buyer")).some((r) => r.id === "m-flood"), true);
    assert.equal(net.sends, sendsBefore);
  });

  it("a thread whose team member just replied stays with them when the AI is down", async () => {
    await handleEventV2(event("m1"));
    const [t] = await db()`SELECT id FROM threads`;
    await db()`UPDATE threads SET status = 'assigned'`;
    await db()`INSERT INTO thread_messages (id, thread_id, sender, text) VALUES ('staff-1', ${t.id as string}, 'staff', 'On it')`;
    net.ai = "down";
    await handleEventV2(event("m2"));
    assert.equal((await thread()).status, "assigned");
    assert.equal((await rows("buyer")).length, 2);
    assert.equal(net.sends, 1);
  });
});

describe("the webhook route", () => {
  const signed = (body: string, over: Record<string, string> = {}) => {
    const nonce = "abc123";
    const timestamp = String(Date.now());
    const signature = createHash("sha1").update(`test-only${nonce}${timestamp}`).digest("hex");
    return new NextRequest("http://localhost/api/webhooks/nexconn", { method: "POST", headers: { nonce, timestamp, signature, "content-type": "application/json", ...over }, body });
  };

  it("rejects a bad signature, a stale timestamp and a missing signature before reading anything", async () => {
    assert.equal((await webhookRoute(signed("{}", { signature: "0".repeat(40) }))).status, 401);
    assert.equal((await webhookRoute(signed("{}", { timestamp: String(Date.now() - 10 * 60_000) }))).status, 401);
    const bare = new NextRequest("http://localhost/api/webhooks/nexconn", { method: "POST", body: "{}" });
    assert.equal((await webhookRoute(bare)).status, 401);
  });

  it("rejects a signed but malformed or oversized body without processing it", async () => {
    assert.equal((await webhookRoute(signed("not json"))).status, 400);
    assert.equal((await webhookRoute(signed("[]"))).status, 400);
    assert.equal((await webhookRoute(signed(JSON.stringify({ type: "message:send", id: "e", data: "x" })))).status, 400);
    assert.equal((await webhookRoute(signed(JSON.stringify({ type: "message:send", data: [] })))).status, 400);
    assert.equal((await webhookRoute(signed("x".repeat(600 * 1024)))).status, 413);
  });
});

describe("guards", () => {
  it("accepts other event types and shapes the handlers ignore", () => {
    assert.equal(isWebhookEvent({ type: "user:online" }), true);
    assert.equal(isWebhookEvent({ type: "message:send", id: "e", data: [] }), true);
    assert.equal(isWebhookEvent(null), false);
    assert.equal(isWebhookEvent({ id: "e" }), false);
  });

  it("withDeadline rejects a slow job and passes a fast one", async () => {
    await assert.rejects(withDeadline(new Promise(() => undefined), 20, "slow job"), /slow job took longer than 20 ms/);
    assert.equal(await withDeadline(Promise.resolve(7), 1000, "fast job"), 7);
  });
});
