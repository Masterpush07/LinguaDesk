import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { NextRequest } from "next/server";
import { POST as changePasscode } from "@/app/api/auth/change-passcode/route";
import { POST as loginRoute } from "@/app/api/auth/login/route";
import { GET as deskThread } from "@/app/api/desk/threads/[id]/route";
import { POST as deskReply } from "@/app/api/desk/threads/[id]/reply/route";
import { PATCH as teamPatch } from "@/app/api/desk/team/[id]/route";
import { GET as buyerThread } from "@/app/api/buyer/threads/[id]/route";
import { GET as legacyShop } from "@/app/api/shop/route";
import { POST as legacyToken } from "@/app/api/token/route";
import { POST as legacyOwnerToken } from "@/app/api/owner/token/route";
import { POST as legacyOrderConfirm } from "@/app/api/order/confirm/route";
import { GET as legacyConversations } from "@/app/api/owner/conversations/route";
import { db } from "@/lib/db";
import { setOwnerCookie } from "@/lib/owner-auth";
import { isLimited } from "@/lib/rate-limit";
import { currentStaff, setBuyerCookie } from "@/lib/v2/session";
import { addShop, post, resetShops } from "./support/fixtures";
import { jar } from "./support/next-headers";
import { signInAs } from "./support/session";

process.env.NEXCONN_APP_SECRET = "test-only";
process.env.NEXT_PUBLIC_NEXCONN_APP_KEY = "test-only";

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const req = (path: string, method = "GET", body?: unknown) =>
  new NextRequest(`http://localhost${path}`, { method, headers: { "content-type": "application/json", "x-real-ip": "198.51.100.9" }, body: body === undefined ? undefined : JSON.stringify(body) });
const login = (shop: string, name: string, passcode: string, ip: string) => post(loginRoute, "/api/auth/login", { shop, name, passcode }, ip);

async function addThread(sellerId: string, buyerId: string, text: string) {
  await db()`INSERT INTO buyers (id) VALUES (${buyerId}) ON CONFLICT DO NOTHING`;
  const id = `thr_${buyerId}`;
  await db()`INSERT INTO threads (id, seller_id, buyer_id, last_text) VALUES (${id}, ${sellerId}, ${buyerId}, ${text})`;
  await db()`INSERT INTO thread_messages (id, thread_id, sender, text) VALUES (${`m_${buyerId}`}, ${id}, 'buyer', ${text})`;
  return id;
}

describe("rate limiter failure mode", () => {
  beforeEach(resetShops);
  afterEach(async () => {
    await db()`ALTER TABLE IF EXISTS rate_events_hidden RENAME TO rate_events`.catch(() => undefined);
  });

  it("public features fail open, credential routes fail closed, when the counter cannot be read", async () => {
    await addShop({ slug: "shop-a", name: "Shop A", staff: [{ name: "Ann" }] });
    await db()`ALTER TABLE rate_events RENAME TO rate_events_hidden`;
    assert.equal(await isLimited("k", 1, 1), false);
    assert.equal(await isLimited("k", 1, 1, { failClosed: true }), true);
    const res = await login("Shop A", "Ann", "correct horse", "203.0.113.1");
    assert.equal(res.status, 429);
    await db()`ALTER TABLE rate_events_hidden RENAME TO rate_events`;
    assert.equal((await login("Shop A", "Ann", "correct horse", "203.0.113.1")).status, 200);
  });
});

describe("sign-in throttling", () => {
  beforeEach(resetShops);

  it("guessing one account from many addresses is stopped, and other accounts are unaffected", async () => {
    await addShop({ slug: "shop-a", name: "Shop A", staff: [{ name: "Ann" }, { name: "Bob" }] });
    for (let i = 0; i < 50; i++) assert.equal((await login("Shop A", "Ann", "wrong passcode", `203.0.113.${i + 1}`)).status, 401);
    const blocked = await login("Shop A", "Ann", "correct horse", "198.51.100.77"); // fresh address, right passcode
    assert.equal(blocked.status, 429);
    assert.equal((await login("Shop A", "Bob", "correct horse", "198.51.100.77")).status, 200);
  });
});

describe("a passcode change signs other sessions out", () => {
  beforeEach(resetShops);

  it("keeps this device signed in and rejects the cookie another device held before", async () => {
    await addShop({ slug: "shop-a", name: "Shop A", staff: [{ name: "Ann" }] });
    await signInAs("Shop A", "Ann");
    const otherDevice = jar.get("ld_staff")!.value;
    assert.equal((await currentStaff())?.name, "Ann");

    const res = await changePasscode(req("/api/auth/change-passcode", "POST", { current: "correct horse", next: "a brand new passcode" }));
    assert.equal(res.status, 200);
    assert.equal((await currentStaff())?.name, "Ann"); // this device got a fresh cookie

    jar.set("ld_staff", { value: otherDevice });
    assert.equal(await currentStaff(), null);
  });
});

describe("tenant isolation", () => {
  let a = "";
  let b = "";
  let bThread = "";
  let aThread = "";
  beforeEach(async () => {
    await resetShops();
    const shopA = await addShop({ slug: "shop-a", name: "Shop A", staff: [{ name: "Ann" }] });
    const shopB = await addShop({ slug: "shop-b", name: "Shop B", staff: [{ name: "Bea" }] });
    a = shopA.sellerId;
    b = shopB.sellerId;
    aThread = await addThread(a, "gbuyerone", "hello shop a");
    bThread = await addThread(b, "gbuyertwo", "hello shop b");
  });

  it("staff of one shop cannot read, answer or manage another shop's data", async () => {
    await signInAs("Shop A", "Ann");
    assert.equal((await deskThread(req(`/api/desk/threads/${aThread}`), ctx(aThread))).status, 200);
    assert.equal((await deskThread(req(`/api/desk/threads/${bThread}`), ctx(bThread))).status, 404);
    const reply = await deskReply(req(`/api/desk/threads/${bThread}/reply`, "POST", { text: "hi" }), ctx(bThread));
    assert.equal(reply.status, 404);
    const [bea] = await db()`SELECT id FROM staff WHERE seller_id = ${b}`;
    const patch = await teamPatch(req(`/api/desk/team/${bea.id}`, "PATCH", { maxConcurrent: 5 }), ctx(bea.id as string));
    assert.equal(patch.status, 404);
  });

  it("a buyer cannot open another buyer's conversation", async () => {
    await setBuyerCookie("gbuyerone");
    assert.equal((await buyerThread(req(`/api/buyer/threads/${aThread}`), ctx(aThread))).status, 200);
    assert.equal((await buyerThread(req(`/api/buyer/threads/${bThread}`), ctx(bThread))).status, 404);
  });

  it("a buyer cookie is not a staff session", async () => {
    await setBuyerCookie("gbuyerone");
    assert.equal(await currentStaff(), null);
    assert.equal((await deskThread(req(`/api/desk/threads/${aThread}`), ctx(aThread))).status, 401);
  });
});

describe("retired single-shop endpoints", () => {
  const saved = { flag: process.env.ENABLE_LEGACY_SINGLE_SHOP, owner: process.env.OWNER_PASSCODE };
  beforeEach(async () => {
    await resetShops();
    delete process.env.ENABLE_LEGACY_SINGLE_SHOP;
    process.env.OWNER_PASSCODE = "legacy owner passcode";
  });
  afterEach(() => {
    for (const [k, v] of [["ENABLE_LEGACY_SINGLE_SHOP", saved.flag], ["OWNER_PASSCODE", saved.owner]] as const) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  it("are off by default, even with a valid owner cookie", async () => {
    await setOwnerCookie();
    assert.equal((await legacyShop()).status, 404);
    assert.equal((await legacyToken(req("/api/token", "POST"))).status, 404);
    assert.equal((await legacyOwnerToken(req("/api/owner/token", "POST", { passcode: "legacy owner passcode" }))).status, 404);
    assert.equal((await legacyOrderConfirm(req("/api/order/confirm", "POST", {}))).status, 404);
    assert.equal((await legacyConversations()).status, 401);
  });

  it("work again only when switched on deliberately", async () => {
    process.env.ENABLE_LEGACY_SINGLE_SHOP = "1";
    assert.equal((await legacyConversations()).status, 401); // still needs the owner cookie
    await setOwnerCookie();
    assert.equal((await legacyConversations()).status, 200);
  });
});
