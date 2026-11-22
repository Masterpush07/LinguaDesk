import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { NextRequest } from "next/server";
import { GET as deskThread } from "@/app/api/desk/threads/[id]/route";
import { POST as deskReply } from "@/app/api/desk/threads/[id]/reply/route";
import { db } from "@/lib/db";
import { languageCode } from "@/lib/v2/languages";
import { languageCode as languageCodeFromDesk } from "@/lib/v2/desk-translate";
import { languageCode as languageCodeFromVoice } from "@/lib/v2/voice";
import { handleEventV2 } from "@/lib/v2/bot";
import type { WebhookEvent } from "@/lib/bot";
import { addShop, resetShops } from "./support/fixtures";
import { signInAs } from "./support/session";

process.env.NEXCONN_APP_SECRET = "test-only";
process.env.NEXT_PUBLIC_NEXCONN_APP_KEY = "test-only";
process.env.GEMINI_API_KEY = "test-only";
delete process.env.GROQ_API_KEY;

// Gemini and Nexconn are answered locally; anything else is refused.
type Reply = { customer_language: string; customer_text_en: string; answer: string; needs_human: boolean; owner_summary: string };
const net = { reply: null as Reply | null, sent: [] as string[] };
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input instanceof Request ? input.url : input);
  const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });
  if (/generativelanguage\.googleapis\.com/.test(url)) return json({ candidates: [{ content: { parts: [{ text: JSON.stringify(net.reply) }] } }] });
  if (/sg-light-api\.com/.test(url)) {
    net.sent.push((JSON.parse(String(init?.body)) as { content: string }).content);
    return json({ code: 0, result: { messageIds: [{ userId: "x", messageId: `srv-${net.sent.length}` }] } });
  }
  throw new Error(`tests may not reach the network: ${url}`);
}) as typeof fetch;
process.on("exit", () => void (globalThis.fetch = realFetch));

const reply = (over: Partial<Reply> = {}): Reply => ({ customer_language: "Spanish", customer_text_en: "How much is the silk scarf?", answer: "La bufanda de seda cuesta $40.", needs_human: false, owner_summary: "Asked the price of the silk scarf", ...over });
const sentText = (raw: string) => (JSON.parse(raw) as { content?: string }).content ?? raw;

let nexconnId = "";
let sellerId = "";
const event = (messageId: string, text: string): WebhookEvent => ({
  type: "message:send",
  id: `evt-${messageId}`,
  data: [{ userId: "gbuyer1", channelId: nexconnId, channelType: 1, messageType: "RC:TxtMsg", messageId, content: JSON.stringify({ content: text }) }],
});
const thread = async () => (await db()`SELECT id, status, summary FROM threads`)[0];
const buyerMessage = async (id: string) => (await db()`SELECT text, text_en FROM thread_messages WHERE id = ${id}`)[0];
const aiMessages = async () => (await db()`SELECT text FROM thread_messages WHERE sender = 'ai'`).map((r) => r.text as string);

describe("grounded answers and number integrity in the buyer chat", () => {
  beforeEach(async () => {
    await resetShops();
    net.reply = reply();
    net.sent = [];
    const shop = await addShop({ slug: "scarf-shop", name: "Scarf Shop", staff: [{ name: "Ann" }] });
    sellerId = shop.sellerId;
    nexconnId = (await db()`SELECT nexconn_user_id FROM sellers WHERE id = ${sellerId}`)[0].nexconn_user_id as string;
    await db()`INSERT INTO products (id, seller_id, name, description, category, price_usd, stock, active) VALUES ('prd_scarf', ${sellerId}, 'Silk scarf', 'Soft.', 'Scarves', 40, 3, true)`;
  });

  it("an answer that uses the catalogue price is sent and nobody is paged", async () => {
    await handleEventV2(event("m1", "¿Cuánto cuesta la bufanda de seda?"));
    assert.deepEqual(await aiMessages(), ["La bufanda de seda cuesta $40."]);
    assert.equal((await thread()).status, "ai");
    assert.deepEqual(net.sent.map(sentText), ["La bufanda de seda cuesta $40."]);
  });

  it("an answer with an invented price never reaches the buyer: they get the holding reply and the team is told why", async () => {
    net.reply = reply({ answer: "La bufanda de seda cuesta $45." });
    await handleEventV2(event("m1", "¿Cuánto cuesta la bufanda de seda?"));
    const t = await thread();
    assert.equal(t.status, "waiting");
    assert.match(t.summary as string, /blocked because it contains the number 45/);
    assert.doesNotMatch(t.summary as string, /could not be checked/);
    assert.deepEqual(net.sent.map(sentText).filter((s) => s.includes("45")), []);
    assert.match((await aiMessages())[0], /shop team has been notified/);
  });

  it("an answer that makes up a stock quantity is blocked", async () => {
    net.reply = reply({ answer: "Solo quedan 2 bufandas." });
    await handleEventV2(event("m1", "¿Tienen bufandas?"));
    assert.equal((await thread()).status, "waiting");
    assert.match((await thread()).summary as string, /blocked because/);
  });

  it("a spelled-out number in the buyer's language that is not in the shop information is blocked", async () => {
    net.reply = reply({ answer: "La entrega tarda cinco días." });
    await handleEventV2(event("m1", "¿Cuánto tarda la entrega?"));
    assert.equal((await thread()).status, "waiting");
  });

  it("a translation that changes the buyer's number hands over to a person, and both the original and the translation are kept", async () => {
    net.reply = reply({ customer_text_en: "I want 3 scarves", answer: "Con gusto, el equipo le enviará la orden.", needs_human: false });
    await handleEventV2(event("m1", "Quiero 5 bufandas"));
    const t = await thread();
    assert.equal(t.status, "waiting");
    assert.match(t.summary as string, /changed a number/);
    const stored = await buyerMessage("m1");
    assert.equal(stored.text, "Quiero 5 bufandas");
    assert.equal(stored.text_en, "I want 3 scarves");
  });

  it("a faithful translation with a number in another script is not flagged", async () => {
    net.reply = reply({ customer_text_en: "I want 5 scarves", answer: "Con gusto.", needs_human: false });
    await handleEventV2(event("m1", "Quiero ५ bufandas"));
    assert.equal((await thread()).status, "ai");
  });
});

describe("what the shop sees and sends", () => {
  const req = (path: string, method = "GET", body?: unknown) => new NextRequest(`http://localhost${path}`, { method, headers: { "content-type": "application/json", "x-real-ip": "198.51.100.9" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
  let threadId = "";

  beforeEach(async () => {
    await resetShops();
    net.sent = [];
    const shop = await addShop({ slug: "scarf-shop", name: "Scarf Shop", staff: [{ name: "Ann" }] });
    await db()`INSERT INTO buyers (id) VALUES ('gbuyer1')`;
    threadId = "thr_desk";
    await db()`INSERT INTO threads (id, seller_id, buyer_id, language) VALUES (${threadId}, ${shop.sellerId}, 'gbuyer1', 'Spanish')`;
    await db()`INSERT INTO thread_messages (id, thread_id, sender, text, text_en, lang) VALUES
      ('b-ok', ${threadId}, 'buyer', 'Quiero 5 bufandas', 'I want 5 scarves', 'Spanish'),
      ('b-bad', ${threadId}, 'buyer', 'Quiero 5 bufandas por 40', 'I want 3 scarves for 40', 'Spanish'),
      ('b-none', ${threadId}, 'buyer', 'Hola, buenas tardes', 'Hello, good afternoon', 'Spanish')`;
    await signInAs("Scarf Shop", "Ann");
  });

  it("the desk marks whether each buyer message kept its numbers in the English reading, and keeps the original", async () => {
    const res = await deskThread(req(`/api/desk/threads/${threadId}`), ctx(threadId));
    assert.equal(res.status, 200);
    const body = (await res.json()) as { messages: { id: string; text: string; textEn: string; numbersCheck: string | null }[] };
    const by = Object.fromEntries(body.messages.map((m) => [m.id, m]));
    assert.equal(by["b-ok"].numbersCheck, "ok");
    assert.equal(by["b-bad"].numbersCheck, "mismatch");
    assert.equal(by["b-none"].numbersCheck, null);
    assert.equal(by["b-bad"].text, "Quiero 5 bufandas por 40"); // the original is never replaced
  });

  it("a reply whose translation changed a number is refused and nothing is sent", async () => {
    const res = await deskReply(req(`/api/desk/threads/${threadId}/reply`, "POST", { text: "The scarf is $40.", translation: "La bufanda cuesta $45." }), ctx(threadId));
    assert.equal(res.status, 422);
    assert.deepEqual(net.sent, []);
    assert.equal((await db()`SELECT id FROM thread_messages WHERE sender = 'staff'`).length, 0);
  });

  it("a faithful reply is sent in the buyer's language and the agent's English original is stored beside it", async () => {
    const res = await deskReply(req(`/api/desk/threads/${threadId}/reply`, "POST", { text: "The scarf is $40 and ships in 7 days.", translation: "La bufanda cuesta 40 $ y se envía en 7 días." }), ctx(threadId));
    assert.equal(res.status, 200);
    assert.deepEqual(net.sent.map(sentText), ["La bufanda cuesta 40 $ y se envía en 7 días."]);
    const [row] = await db()`SELECT text, text_en, numbers_verified FROM thread_messages WHERE sender = 'staff'`;
    assert.equal(row.text, "La bufanda cuesta 40 $ y se envía en 7 días.");
    assert.equal(row.text_en, "The scarf is $40 and ships in 7 days.");
    assert.equal(row.numbers_verified, true);
  });
});

describe("one language table", () => {
  it("names and codes map the same everywhere and never guess", () => {
    assert.equal(languageCode("Spanish"), "es");
    assert.equal(languageCode("  Malayalam "), "ml");
    assert.equal(languageCode("Bengali"), "bn");
    assert.equal(languageCode("Mandarin"), "zh");
    assert.equal(languageCode("pt-BR"), "pt");
    assert.equal(languageCode("fr"), "fr");
    assert.equal(languageCode("Klingon"), null);
    assert.equal(languageCode(null), null);
    for (const name of ["Spanish", "Greek", "Punjabi", "Klingon", "ta"]) {
      assert.equal(languageCodeFromDesk(name), languageCode(name));
      assert.equal(languageCodeFromVoice(name), languageCode(name));
    }
  });
});
