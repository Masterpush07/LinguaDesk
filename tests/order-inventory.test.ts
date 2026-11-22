import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { NextRequest } from "next/server";
import { POST as cancelRoute } from "@/app/api/buyer/orders/[id]/cancel/route";
import { POST as confirmRoute } from "@/app/api/buyer/orders/[id]/confirm/route";
import { POST as requestRoute } from "@/app/api/buyer/orders/request/route";
import { PATCH as deskOrderPatch } from "@/app/api/desk/orders/[id]/route";
import { db } from "@/lib/db";
import { newId } from "@/lib/v2/crypto";
import { confirmOrderWithStock } from "@/lib/v2/inventory";
import { setBuyerCookie } from "@/lib/v2/session";
import { addShop, resetShops } from "./support/fixtures";
import { jar } from "./support/next-headers";
import { signInAs } from "./support/session";

process.env.NEXCONN_APP_SECRET = "test-only";
process.env.NEXT_PUBLIC_NEXCONN_APP_KEY = "test-only";

// Nexconn is answered locally; anything else is refused.
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL) => {
  const url = String(input instanceof Request ? input.url : input);
  if (!/sg-light-api\.com/.test(url)) throw new Error(`tests may not reach the network: ${url}`);
  return new Response(JSON.stringify({ code: 0, result: { messageIds: [{ userId: "x", messageId: newId("srv") }] } }), { headers: { "content-type": "application/json" } });
}) as typeof fetch;
process.on("exit", () => void (globalThis.fetch = realFetch));

const ADDRESS = { fullName: "Asha Rao", phone: "+91 98765 43210", line1: "12 Park Street", line2: "", city: "Kolkata", region: "WB", postalCode: "700016", country: "India" };
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const call = (path: string, body: unknown, method = "POST") =>
  new NextRequest(`http://localhost${path}`, { method, headers: { "content-type": "application/json", "x-real-ip": "198.51.100.9" }, body: JSON.stringify(body) });

let sellerId = "";
async function product(name: string, stock: number, extra: { colors?: string[]; price?: number } = {}) {
  const id = newId("prd");
  await db()`INSERT INTO products (id, seller_id, name, description, category, price_usd, stock, active, colors) VALUES (${id}, ${sellerId}, ${name}, 'Nice.', 'Goods', ${extra.price ?? 10}, ${stock}, true, ${extra.colors ?? []})`;
  return id;
}
const stockOf = async (id: string) => (await db()`SELECT stock FROM products WHERE id = ${id}`)[0].stock as number;
const orderStatus = async (id: string) => (await db()`SELECT status FROM orders_v2 WHERE id = ${id}`)[0].status as string;

async function requestOrder(buyer: string, productId: string, qty: number, extra: Record<string, unknown> = {}) {
  await setBuyerCookie(buyer);
  const res = await requestRoute(call("/api/buyer/orders/request", { sellerSlug: "shop-a", productId, qty, ...extra }));
  return { status: res.status, json: (await res.json()) as Record<string, unknown> };
}
async function confirm(buyer: string, orderId: string) {
  await setBuyerCookie(buyer);
  const res = await confirmRoute(call(`/api/buyer/orders/${orderId}/confirm`, { delivery: ADDRESS }), ctx(orderId));
  return { status: res.status, json: (await res.json()) as Record<string, unknown> };
}

describe("buy now: starting an order without the shop", () => {
  beforeEach(async () => {
    await resetShops();
    sellerId = (await addShop({ slug: "shop-a", name: "Shop A", staff: [{ name: "Ann" }] })).sellerId;
  });

  it("creates a proposed order priced from the catalogue, reserves nothing and shows it in the chat", async () => {
    const p = await product("Teapot", 3, { colors: ["red", "blue"], price: 12 });
    const res = await requestOrder("gbuyer1", p, 2, { colour: "red", total: 1, price: 1 }); // a client-supplied price is ignored
    assert.equal(res.status, 201);
    const [order] = await db()`SELECT status, total, card FROM orders_v2 WHERE id = ${res.json.orderId as string}`;
    assert.equal(order.status, "proposed");
    assert.equal(order.total, 24);
    assert.equal((order.card as { lines: { name: string }[] }).lines[0].name, "Teapot (red)");
    assert.equal(await stockOf(p), 3);
    const msgs = await db()`SELECT order_id FROM thread_messages WHERE order_id = ${res.json.orderId as string}`;
    assert.equal(msgs.length, 1);
  });

  it("refuses what cannot be bought: no session, too many, unknown colour, another shop's product", async () => {
    const p = await product("Teapot", 2, { colors: ["red"] });
    jar.clear();
    assert.equal((await requireNoSession(p)).status, 401);
    assert.equal((await requestOrder("gbuyer1", p, 3)).status, 409);
    assert.equal((await requestOrder("gbuyer1", p, 1, { colour: "green" })).status, 400);
    assert.equal((await requestOrder("gbuyer1", p, 0)).status, 400);
    const other = await addShop({ slug: "shop-b", name: "Shop B", staff: [{ name: "Bea" }] });
    const foreign = newId("prd");
    await db()`INSERT INTO products (id, seller_id, name, description, category, price_usd, stock, active) VALUES (${foreign}, ${other.sellerId}, 'Vase', 'x', 'Goods', 5, 5, true)`;
    assert.equal((await requestOrder("gbuyer1", foreign, 1)).status, 404);
  });
});

async function requireNoSession(productId: string) {
  return requestRoute(call("/api/buyer/orders/request", { sellerSlug: "shop-a", productId, qty: 1 }));
}

describe("stock is taken when the buyer confirms", () => {
  beforeEach(async () => {
    await resetShops();
    sellerId = (await addShop({ slug: "shop-a", name: "Shop A", staff: [{ name: "Ann" }] })).sellerId;
  });

  it("reserves the quantity once, however many times confirm is tapped, and tells the shop", async () => {
    const p = await product("Teapot", 3);
    const { json } = await requestOrder("gbuyer1", p, 2);
    const orderId = json.orderId as string;
    assert.equal((await confirm("gbuyer1", orderId)).status, 200);
    assert.equal(await stockOf(p), 1);
    assert.equal(await orderStatus(orderId), "confirmed");
    const again = await confirm("gbuyer1", orderId);
    assert.equal(again.json.alreadyConfirmed, true);
    assert.equal(await stockOf(p), 1);
    const kinds = (await db()`SELECT kind FROM notifications WHERE seller_id = ${sellerId}`).map((r) => r.kind);
    assert.ok(kinds.includes("order_confirmed"));
  });

  it("the last unit is sold once: the second buyer is told it is gone, the order stays open and the shop is told", async () => {
    const p = await product("Last teapot", 1);
    const a = (await requestOrder("gbuyer1", p, 1)).json.orderId as string;
    const b = (await requestOrder("gbuyer2", p, 1)).json.orderId as string;
    const [first, second] = await Promise.all([confirmOrderWithStock(a, "gbuyer1", ADDRESS), confirmOrderWithStock(b, "gbuyer2", ADDRESS)]);
    assert.deepEqual([first.kind, second.kind].sort(), ["confirmed", "out_of_stock"]);
    assert.equal(await stockOf(p), 0);
    const loser = first.kind === "out_of_stock" ? a : b;
    assert.equal(await orderStatus(loser), "proposed");

    // Through the route the buyer who lost is told, the shop is alerted and the order stays open.
    const buyer = loser === a ? "gbuyer1" : "gbuyer2";
    const lost = await confirm(buyer, loser);
    assert.equal(lost.status, 409);
    assert.equal(lost.json.code, "out_of_stock");
    assert.equal(await orderStatus(loser), "proposed");
    const [note] = await db()`SELECT title FROM notifications WHERE seller_id = ${sellerId} AND kind = 'needs_reply'`;
    assert.match(note.title as string, /could not be confirmed/);
  });

  it("an order with several lines is all or nothing: one short line leaves every other product untouched", async () => {
    const plenty = await product("Plenty", 5);
    const scarce = await product("Scarce", 1);
    await db()`INSERT INTO buyers (id) VALUES ('gbuyer1') ON CONFLICT DO NOTHING`;
    await db()`INSERT INTO threads (id, seller_id, buyer_id) VALUES ('thr_multi', ${sellerId}, 'gbuyer1')`;
    const card = { id: "ord_multi", lines: [], subtotal: 0, shipping: 0, total: 40, labels: {}, reserve: [{ id: plenty, qty: 2 }, { id: scarce, qty: 2 }] };
    await db()`INSERT INTO orders_v2 (id, seller_id, thread_id, buyer_id, card, total, status) VALUES ('ord_multi', ${sellerId}, 'thr_multi', 'gbuyer1', ${JSON.stringify(card)}::jsonb, 40, 'proposed')`;
    const res = await confirm("gbuyer1", "ord_multi");
    assert.equal(res.status, 409);
    assert.equal(await stockOf(plenty), 5);
    assert.equal(await stockOf(scarce), 1);
    assert.equal(await orderStatus("ord_multi"), "proposed");
  });

  it("an order proposed before stock tracking (no reserve list) still confirms and touches no stock", async () => {
    const p = await product("Old", 4);
    await db()`INSERT INTO buyers (id) VALUES ('gbuyer1') ON CONFLICT DO NOTHING`;
    await db()`INSERT INTO threads (id, seller_id, buyer_id) VALUES ('thr_old', ${sellerId}, 'gbuyer1')`;
    await db()`INSERT INTO orders_v2 (id, seller_id, thread_id, buyer_id, card, total, status) VALUES ('ord_old', ${sellerId}, 'thr_old', 'gbuyer1', ${JSON.stringify({ id: "ord_old", lines: [], subtotal: 5, shipping: 0, total: 5, labels: {} })}::jsonb, 5, 'proposed')`;
    assert.equal((await confirm("gbuyer1", "ord_old")).status, 200);
    assert.equal(await stockOf(p), 4);
    await setBuyerCookie("gbuyer1");
    assert.equal((await cancelRoute(call("/api/buyer/orders/ord_old/cancel", {}), ctx("ord_old"))).status, 200);
    assert.equal(await stockOf(p), 4); // nothing was taken, so nothing is given back
  });
});

describe("stock comes back when a reserved order is cancelled", () => {
  beforeEach(async () => {
    await resetShops();
    sellerId = (await addShop({ slug: "shop-a", name: "Shop A", staff: [{ name: "Ann" }] })).sellerId;
  });

  it("buyer cancel restocks once; cancelling a proposed order changes nothing", async () => {
    const p = await product("Teapot", 3);
    const open = (await requestOrder("gbuyer1", p, 1)).json.orderId as string;
    await setBuyerCookie("gbuyer1");
    assert.equal((await cancelRoute(call(`/api/buyer/orders/${open}/cancel`, {}), ctx(open))).status, 200);
    assert.equal(await stockOf(p), 3);

    const taken = (await requestOrder("gbuyer1", p, 2)).json.orderId as string;
    await confirm("gbuyer1", taken);
    assert.equal(await stockOf(p), 1);
    await setBuyerCookie("gbuyer1");
    assert.equal((await cancelRoute(call(`/api/buyer/orders/${taken}/cancel`, {}), ctx(taken))).status, 200);
    assert.equal(await stockOf(p), 3);
    assert.equal((await cancelRoute(call(`/api/buyer/orders/${taken}/cancel`, {}), ctx(taken))).status, 409);
    assert.equal(await stockOf(p), 3);
  });

  it("the shop cancelling a confirmed order restocks it, and a shipped order cannot be cancelled", async () => {
    const p = await product("Teapot", 3);
    const orderId = (await requestOrder("gbuyer1", p, 3)).json.orderId as string;
    await confirm("gbuyer1", orderId);
    assert.equal(await stockOf(p), 0);
    await signInAs("Shop A", "Ann");
    const res = await deskOrderPatch(call(`/api/desk/orders/${orderId}`, { status: "cancelled" }, "PATCH"), ctx(orderId));
    assert.equal(res.status, 200);
    assert.equal(await stockOf(p), 3);

    const second = (await requestOrder("gbuyer1", p, 1)).json.orderId as string;
    await confirm("gbuyer1", second);
    await db()`UPDATE orders_v2 SET status = 'shipped' WHERE id = ${second}`;
    await signInAs("Shop A", "Ann");
    assert.equal((await deskOrderPatch(call(`/api/desk/orders/${second}`, { status: "cancelled" }, "PATCH"), ctx(second))).status, 409);
    assert.equal(await stockOf(p), 2);
  });
});
