import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { NextRequest } from "next/server";
import { POST as signupRoute } from "@/app/api/auth/signup/route";
import { PUT as settingsPut, GET as settingsGet } from "@/app/api/desk/settings/route";
import { db } from "@/lib/db";
import { sellerBySlug } from "@/lib/v2/shop";
import { addShop, post, resetShops } from "./support/fixtures";
import { signInAs } from "./support/session";

const OLD = "barbara";
const NEW = "homely-kitchen";

// The only network call sign-up makes is to Nexconn (it registers the shop's chat identity). It is answered locally; anything else is refused.
const realFetch = globalThis.fetch;
const nexconnCalls: string[] = [];
globalThis.fetch = (async (input: RequestInfo | URL) => {
  const url = String(input instanceof Request ? input.url : input);
  if (!/sg-light-api\.com/.test(url)) throw new Error(`tests may not reach the network: ${url}`);
  nexconnCalls.push(url);
  return new Response(JSON.stringify({ code: 0, result: { userId: "u", accessToken: "test-token" } }), { headers: { "content-type": "application/json" } });
}) as typeof fetch;
process.env.NEXCONN_APP_SECRET = "test-only";
process.env.NEXT_PUBLIC_NEXCONN_APP_KEY = "test-only";
process.on("exit", () => void (globalThis.fetch = realFetch));

const signup = (shopName: string, ownerName = "Someone New", ip = "203.0.113.50") => post(signupRoute, "/api/auth/signup", { shopName, ownerName, passcode: "a long enough passcode", country: "India", languages: ["en"] }, ip);

describe("sign-up and the names it hands out", () => {
  beforeEach(async () => {
    await resetShops();
    nexconnCalls.length = 0;
  });

  it("an ordinary shop is created exactly as before", async () => {
    const res = await signup("Spice Garden");
    assert.equal(res.status, 200);
    assert.equal((res.json?.seller as { slug: string }).slug, "spice-garden");
    assert.equal(nexconnCalls.length, 1);
  });

  it("the second shop with a clashing slug still gets a numbered slug when the display names differ", async () => {
    await signup("Spice Garden");
    const res = await signup("Spice-Garden!");
    assert.equal(res.status, 200);
    assert.equal((res.json?.seller as { slug: string }).slug, "spice-garden-2");
  });

  it("neither address of a renamed shop can be taken by a new shop, whatever the capitalisation", async () => {
    for (const name of ["Barbara", "BARBARA", "barbara", "Homely Kitchen", "homely-kitchen", "  Homely   Kitchen "]) {
      const res = await signup(name);
      assert.equal(res.status, 409, name);
      assert.equal(res.json?.error, "Another shop already uses this name. Choose a different shop name.");
    }
    assert.equal(nexconnCalls.length, 0, "refused before any chat identity was created");
    const [{ n }] = await db()`SELECT count(*)::int AS n FROM sellers`;
    assert.equal(n, 0);
  });

  it("a display name another shop already uses is refused, in any capitalisation (this was possible before)", async () => {
    await addShop({ slug: "lotus-handloom", name: "Lotus Handloom", staff: [{ name: "P" }] });
    assert.equal((await signup("LOTUS HANDLOOM")).status, 409);
    assert.equal((await signup("Lotus Handloom 2")).status, 200);
  });

  it("look-alikes that are genuinely different names are still allowed", async () => {
    for (const name of ["Barbara Foods", "Homely Kitchens", "Homely Kitchen Two"]) assert.equal((await signup(name, "Owner", `198.51.100.${name.length}`)).status, 200, name);
  });
});

describe("renaming a shop in Settings", () => {
  const settingsBody = async (name: string) => {
    const current = (await (await settingsGet()).json()) as Record<string, unknown>;
    return { ...current, name };
  };
  const rename = async (name: string) => {
    const res = await settingsPut(new NextRequest("http://localhost/api/desk/settings", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(await settingsBody(name)) }));
    return { status: res.status, json: (await res.json()) as Record<string, unknown> };
  };

  beforeEach(resetShops);

  it("another shop cannot rename itself to either address of the pair", async () => {
    await addShop({ slug: "lotus-handloom", name: "Lotus Handloom", staff: [{ name: "Pushpanathan" }] });
    await signInAs("lotus-handloom", "Pushpanathan");
    for (const name of ["Barbara", "Homely Kitchen"]) assert.equal((await rename(name)).status, 409, name);
    assert.equal((await rename("Lotus Handloom Studio")).status, 200);
  });

  it("the shop that holds one of the pair may use either name (it can rename itself in-app, before or after the database rename)", async () => {
    await addShop({ slug: OLD, name: OLD, staff: [{ name: "Boomu" }] });
    await signInAs(OLD, "Boomu");
    const res = await rename("Homely Kitchen");
    assert.equal(res.status, 200);
    assert.equal(res.json.name, "Homely Kitchen");
    assert.equal(res.json.slug, OLD, "a display-name change never moves the slug");
    assert.equal(res.json.shareUrlPath, `/s/${OLD}`);
  });

  it("the share link follows the slug in the record", async () => {
    await addShop({ slug: NEW, name: "Homely Kitchen", staff: [{ name: "Boomu" }] });
    await signInAs(NEW, "Boomu");
    assert.equal(((await (await settingsGet()).json()) as { shareUrlPath: string }).shareUrlPath, "/s/homely-kitchen");
  });
});

describe("thread creation looks the shop up by slug (sellerBySlug)", () => {
  beforeEach(resetShops);

  it("after the rename, the old slug (a stale tab) and the new one both reach the shop", async () => {
    const { sellerId } = await addShop({ slug: NEW, name: "Homely Kitchen", staff: [{ name: "Boomu" }] });
    assert.equal((await sellerBySlug(OLD))?.id, sellerId);
    assert.equal((await sellerBySlug(NEW))?.id, sellerId);
  });

  it("after a rollback, the new slug still reaches the shop", async () => {
    const { sellerId } = await addShop({ slug: OLD, name: OLD, staff: [{ name: "Boomu" }] });
    assert.equal((await sellerBySlug(NEW))?.id, sellerId);
    assert.equal((await sellerBySlug(OLD))?.id, sellerId);
  });

  it("when both exist each slug returns its own shop, never the other", async () => {
    const a = await addShop({ slug: OLD, name: OLD, staff: [{ name: "Boomu" }] });
    const b = await addShop({ slug: NEW, name: "Homely Kitchen", staff: [{ name: "Priya" }] });
    assert.equal((await sellerBySlug(OLD))?.id, a.sellerId);
    assert.equal((await sellerBySlug(NEW))?.id, b.sellerId);
  });

  it("neither existing returns nothing, and other slugs are unaffected", async () => {
    const { sellerId } = await addShop({ slug: "lotus-handloom", name: "Lotus Handloom", staff: [{ name: "P" }] });
    assert.equal(await sellerBySlug(OLD), null);
    assert.equal(await sellerBySlug(NEW), null);
    assert.equal((await sellerBySlug("lotus-handloom"))?.id, sellerId);
    assert.equal(await sellerBySlug("Lotus-Handloom"), null, "slugs stay case-sensitive");
  });
});
