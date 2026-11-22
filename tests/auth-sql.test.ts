import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { POST as loginRoute } from "@/app/api/auth/login/route";
import { POST as recoverRoute } from "@/app/api/auth/recover/route";
import { db } from "@/lib/db";
import { verifyToken } from "@/lib/v2/crypto";
import { jar } from "./support/next-headers";
import { addShop, post, removeShop, renameShop, resetShops } from "./support/fixtures";

// These run the real sign-in and recovery route handlers, with their real SQL, on the real production schema (in memory).
const OLD = "barbara";
const NEW = "homely-kitchen";
const login = (shop: string, name: string, passcode: string, ip?: string) => post(loginRoute, "/api/auth/login", { shop, name, passcode }, ip);
const recover = (shop: string, name: string, recoveryCode: string) => post(recoverRoute, "/api/auth/recover", { shop, name, recoveryCode, newPasscode: "a brand new passcode" });
const staffCookie = () => jar.get("ld_staff");
const signedInStaffId = () => verifyToken<{ s: string }>(staffCookie()?.value)?.s;

describe("sign-in after the rename", () => {
  let boomu: string;
  let pushpanathan: string;
  beforeEach(async () => {
    await resetShops();
    boomu = (await addShop({ slug: NEW, name: "Homely Kitchen", staff: [{ name: "Boomu", passcode: "boomu passcode" }] })).staffIds.Boomu;
    pushpanathan = (await addShop({ slug: "lotus-handloom", name: "Lotus Handloom", staff: [{ name: "Pushpanathan", passcode: "lotus passcode" }] })).staffIds.Pushpanathan;
  });

  it("the old identifier 'barbara' still finds the renamed shop (and its own staff member, not another)", async () => {
    const res = await login(OLD, "Boomu", "boomu passcode");
    assert.equal(res.status, 200);
    assert.deepEqual(res.json?.seller, { slug: NEW, name: "Homely Kitchen" });
    assert.ok(staffCookie(), "a session cookie was set");
    assert.ok(boomu);
  });

  it("the new name, the new slug and any capitalisation find the shop", async () => {
    for (const typed of ["Homely Kitchen", "homely kitchen", "HOMELY-KITCHEN", "Barbara", " barbara "]) {
      jar.clear();
      assert.equal((await login(typed, "boomu", "boomu passcode")).status, 200, typed);
    }
  });

  it("an unrelated shop signs in exactly as before", async () => {
    const res = await login("Lotus Handloom", "Pushpanathan", "lotus passcode");
    assert.equal(res.status, 200);
    assert.equal((res.json?.seller as { slug: string }).slug, "lotus-handloom");
    assert.ok(pushpanathan);
  });

  it("the alias never lets someone from another shop in, even with that shop's correct passcode", async () => {
    assert.equal((await login(OLD, "Pushpanathan", "lotus passcode")).status, 401);
    assert.equal((await login(NEW, "Pushpanathan", "lotus passcode")).status, 401);
    assert.equal(staffCookie(), undefined);
  });

  it("a wrong passcode is refused with the same generic error, and counted against the rate limit", async () => {
    const res = await login(OLD, "Boomu", "wrong");
    assert.equal(res.status, 401);
    assert.equal(res.json?.error, "The shop, name or passcode is incorrect.");
    const [{ n }] = await db()`SELECT count(*)::int AS n FROM rate_events WHERE key LIKE 'v2-login-fail:%'`;
    assert.equal(n, 1);
  });

  it("the rate limit is unchanged: after 8 failures the right passcode is refused too, and other addresses are not affected", async () => {
    for (let i = 0; i < 8; i++) assert.equal((await login(OLD, "Boomu", "wrong", "198.51.100.9")).status, 401);
    assert.equal((await login(OLD, "Boomu", "boomu passcode", "198.51.100.9")).status, 429);
    assert.equal((await login(OLD, "Boomu", "boomu passcode", "198.51.100.10")).status, 200);
  });
});

describe("sign-in after a rollback (the old record is back, the new name was already given out)", () => {
  beforeEach(async () => {
    await resetShops();
    await addShop({ slug: OLD, name: OLD, staff: [{ name: "Boomu", passcode: "boomu passcode" }] });
    await addShop({ slug: "lotus-handloom", name: "Lotus Handloom", staff: [{ name: "Pushpanathan", passcode: "lotus passcode" }] });
  });

  it("both 'barbara' and 'Homely Kitchen' find the shop", async () => {
    for (const typed of [OLD, "Homely Kitchen", NEW]) {
      jar.clear();
      const res = await login(typed, "Boomu", "boomu passcode");
      assert.equal(res.status, 200, typed);
      assert.equal((res.json?.seller as { slug: string }).slug, OLD, typed);
    }
  });

  it("the alias still cannot reach another shop", async () => {
    assert.equal((await login("Homely Kitchen", "Pushpanathan", "lotus passcode")).status, 401);
  });
});

describe("the rename itself, with the real statements, moves the shop without touching its staff", () => {
  it("the same staff row (id, passcode) signs in before and after, and again after the rollback", async () => {
    await resetShops();
    const { staffIds } = await addShop({ slug: OLD, name: OLD, staff: [{ name: "Boomu", passcode: "boomu passcode" }] });
    assert.equal((await login(OLD, "Boomu", "boomu passcode")).status, 200);
    assert.equal(signedInStaffId(), staffIds.Boomu);

    await renameShop(OLD, { slug: NEW, name: "Homely Kitchen" });
    jar.clear();
    assert.equal((await login(OLD, "Boomu", "boomu passcode")).status, 200);
    assert.equal(signedInStaffId(), staffIds.Boomu, "the session names the same staff row after the rename");
    jar.clear();
    assert.equal((await login("Homely Kitchen", "Boomu", "boomu passcode")).status, 200);
    assert.equal(signedInStaffId(), staffIds.Boomu);

    await renameShop(NEW, { slug: OLD, name: OLD });
    jar.clear();
    assert.equal((await login("Homely Kitchen", "Boomu", "boomu passcode")).status, 200);
    assert.equal(signedInStaffId(), staffIds.Boomu);
  });
});

describe("ambiguity: two shops that could both match what was typed", () => {
  beforeEach(resetShops);

  it("when BOTH slugs exist as different shops, each identifier finds only its own shop", async () => {
    await addShop({ slug: OLD, name: OLD, staff: [{ name: "Boomu", passcode: "boomu passcode" }] });
    await addShop({ slug: NEW, name: "Homely Kitchen", staff: [{ name: "Priya", passcode: "priya passcode" }] });
    assert.equal((await login(OLD, "Boomu", "boomu passcode")).status, 200);
    assert.equal((await login(NEW, "Priya", "priya passcode")).status, 200);
    // the alias must not hop across: 'barbara' is a real shop, so Priya (who works at the other shop) cannot use it
    assert.equal((await login(OLD, "Priya", "priya passcode")).status, 401);
    assert.equal((await login(NEW, "Boomu", "boomu passcode")).status, 401);
    assert.equal((await login("Homely Kitchen", "Boomu", "boomu passcode")).status, 401);
  });

  it("when BOTH exist, recovery does not hop across either", async () => {
    await addShop({ slug: OLD, name: OLD, staff: [{ name: "Boomu", recovery: "AAAA-BBBB-CCCC" }] });
    await addShop({ slug: NEW, name: "Homely Kitchen", staff: [{ name: "Priya", recovery: "DDDD-EEEE-FFFF" }] });
    assert.equal((await recover(OLD, "Priya", "DDDD-EEEE-FFFF")).status, 401);
    assert.equal((await recover(NEW, "Boomu", "AAAA-BBBB-CCCC")).status, 401);
    assert.equal((await recover(OLD, "Boomu", "AAAA-BBBB-CCCC")).status, 200);
  });

  it("when the old identifier is only a display name of another shop, that shop wins and the renamed shop is reached by its new name", async () => {
    await addShop({ slug: NEW, name: "Homely Kitchen", staff: [{ name: "Boomu", passcode: "boomu passcode" }] });
    await addShop({ slug: "barbara-2", name: "Barbara", staff: [{ name: "Sam", passcode: "sam passcode" }] });
    assert.equal((await login("Barbara", "Sam", "sam passcode")).status, 200);
    assert.equal((await login("Homely Kitchen", "Boomu", "boomu passcode")).status, 200);
  });
});

describe("recovery after the rename", () => {
  beforeEach(async () => {
    await resetShops();
    await addShop({ slug: NEW, name: "Homely Kitchen", staff: [{ name: "Boomu", recovery: "AAAA-BBBB-CCCC" }, { name: "Agent", role: "agent", recovery: "ZZZZ-YYYY-XXXX" }] });
  });

  it("the old identifier finds the renamed shop's owner", async () => {
    assert.equal((await recover(OLD, "Boomu", "AAAA-BBBB-CCCC")).status, 200);
  });

  it("recovery stays owner-only, and a wrong code is refused with the generic error", async () => {
    assert.equal((await recover(OLD, "Agent", "ZZZZ-YYYY-XXXX")).status, 401);
    const res = await recover(OLD, "Boomu", "WRONG-WRONG-WRONG");
    assert.equal(res.status, 401);
    assert.equal(res.json?.error, "The shop, name or recovery code is incorrect.");
  });
});

describe("removing and renaming shops in the fixtures behaves like the schema says", () => {
  it("slug stays unique", async () => {
    await resetShops();
    await addShop({ slug: NEW, name: "Homely Kitchen", staff: [{ name: "Boomu" }] });
    await assert.rejects(() => addShop({ slug: NEW, name: "Other", staff: [{ name: "X" }] }));
    await removeShop(NEW);
  });
});
