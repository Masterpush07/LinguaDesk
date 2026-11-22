import assert from "node:assert/strict";
import { AsyncLocalStorage } from "node:async_hooks";
import { afterEach, beforeEach, describe, it } from "node:test";
import { config, proxy } from "../proxy";
import { decideSlugRedirect, planSlugRedirect, SLUG_ALIASES } from "@/lib/v2/slug-aliases";
import { slugAliasProxy } from "@/lib/v2/slug-alias-proxy";
import { addShop, removeShop, renameShop, resetShops } from "./support/fixtures";

const OLD = "barbara";
const NEW = "homely-kitchen";
const ORIGIN = "https://shop.example";
const QUERY = "?product=prd_Yi3Ya4RmuQ03&intent=order&item=Silk-cotton+saree&qty=3&colour=maroon&size=5.5+metres%2C+one+size";

// proxy.ts is called exactly as Next calls it (a Request), and its slug lookup is the real SQL, on rows in an in-memory Postgres.
type Outcome = { status: number; location: string | null; cache: string | null } | "continues";
const hit = async (path: string, method = "GET"): Promise<Outcome> => {
  const res = await proxy(new Request(`${ORIGIN}${path}`, { method }) as never);
  return res ? { status: res.status, location: res.headers.get("location"), cache: res.headers.get("cache-control") } : "continues";
};
const redirectTo = (path: string): Outcome => ({ status: 308, location: `${ORIGIN}${path}`, cache: "no-store" });

describe("proxy.ts against real rows: every state of the rename", () => {
  const warnings: string[] = [];
  const errors: string[] = [];
  const realWarn = console.warn;
  const realError = console.error;
  beforeEach(async () => {
    await resetShops();
    warnings.length = 0;
    errors.length = 0;
    console.warn = (m: string) => void warnings.push(String(m));
    console.error = (...a: unknown[]) => void errors.push(a.join(" "));
  });
  afterEach(() => {
    console.warn = realWarn;
    console.error = realError;
  });

  const AFTER = [
    ["/s/barbara", "/s/homely-kitchen"],
    ["/s/barbara/p/prd_Yi3Ya4RmuQ03", "/s/homely-kitchen/p/prd_Yi3Ya4RmuQ03"],
    ["/chat/barbara", "/chat/homely-kitchen"],
    [`/chat/barbara${QUERY}`, `/chat/homely-kitchen${QUERY}`],
  ];
  const BEFORE = AFTER.map(([a, b]) => [b, a]);

  it("A. the database holds homely-kitchen, not barbara: the old URLs redirect to the new ones", async () => {
    await addShop({ slug: NEW, name: "Homely Kitchen", staff: [{ name: "Boomu" }] });
    for (const [from, to] of AFTER) assert.deepEqual(await hit(from), redirectTo(to), from);
    for (const [served] of BEFORE) assert.equal(await hit(served), "continues", served);
  });

  it("B. the database holds barbara, not homely-kitchen: the new URLs redirect to the old ones", async () => {
    await addShop({ slug: OLD, name: OLD, staff: [{ name: "Boomu" }] });
    for (const [from, to] of BEFORE) assert.deepEqual(await hit(from), redirectTo(to), from);
    for (const [served] of AFTER) assert.equal(await hit(served), "continues", served);
  });

  it("C. both exist (two different shops): nothing is redirected in either direction, and a clear warning is logged", async () => {
    await addShop({ slug: OLD, name: OLD, staff: [{ name: "Boomu" }] });
    await addShop({ slug: NEW, name: "Homely Kitchen", staff: [{ name: "Priya" }] });
    for (const [a, b] of AFTER) {
      assert.equal(await hit(a), "continues", a);
      assert.equal(await hit(b), "continues", b);
    }
    assert.equal(warnings.length, 8);
    assert.match(warnings[0], /SLUG ALIAS CONFLICT: sellers "(barbara|homely-kitchen)" and "(homely-kitchen|barbara)" both exist/);
    assert.match(warnings[0], /not redirected/);
  });

  it("D. neither exists: nothing is invented, the request continues to the normal not-found page", async () => {
    await addShop({ slug: "lotus-handloom", name: "Lotus Handloom", staff: [{ name: "P" }] });
    for (const [a, b] of AFTER) {
      assert.equal(await hit(a), "continues", a);
      assert.equal(await hit(b), "continues", b);
    }
    assert.equal(warnings.length, 0);
  });

  it("E. a failed lookup redirects nothing (no unverified assumption, so no loop either) and is logged", async () => {
    const failing = async () => { throw new Error("database unavailable"); };
    for (const path of ["/s/barbara", "/s/homely-kitchen", "/s/barbara/p/prd_1", "/chat/homely-kitchen"]) {
      assert.equal(await slugAliasProxy({ url: `${ORIGIN}${path}` }, failing), undefined, path);
    }
    assert.equal(errors.length, 4);
    assert.match(errors[0], /slug alias redirect skipped \(lookup failed\): database unavailable/);
  });

  it("E. a lookup that never answers is cut off after the time limit and the request continues (the page is never held up)", async () => {
    const hung = () => new Promise<never>(() => undefined);
    const started = Date.now();
    assert.equal(await slugAliasProxy({ url: `${ORIGIN}/s/barbara` }, hung, 50), undefined);
    assert.ok(Date.now() - started < 1000, "returned promptly");
    assert.match(errors.at(-1) ?? "", /slug alias redirect skipped \(lookup failed\): took longer than 50 ms/);
    // the limit does not get in the way of a fast answer
    const quick = async (slugs: readonly string[]) => slugs.filter((s) => s === NEW);
    assert.equal((await slugAliasProxy({ url: `${ORIGIN}/s/barbara` }, quick, 50))?.status, 308);
  });

  it("E. a database that is really unreachable behaves the same through proxy.ts", async () => {
    await addShop({ slug: NEW, name: "Homely Kitchen", staff: [{ name: "Boomu" }] });
    const { testPg } = await import("./support/neon-shim");
    const pg = await testPg();
    const original = pg.query.bind(pg);
    (pg as { query: unknown }).query = async () => { throw new Error("connection refused"); };
    try {
      assert.equal(await hit("/s/barbara"), "continues");
      assert.equal(await hit("/s/homely-kitchen"), "continues");
    } finally {
      (pg as { query: unknown }).query = original;
    }
  });

  it("unrelated shops, look-alikes and other cases are never touched and never queried", async () => {
    await addShop({ slug: NEW, name: "Homely Kitchen", staff: [{ name: "Boomu" }] });
    await addShop({ slug: "lotus-handloom", name: "Lotus Handloom", staff: [{ name: "P" }] });
    for (const path of ["/s/lotus-handloom", "/chat/lotus-handloom", "/s/lotus-handloom/p/prd_1", "/s/barbara-2", "/s/Barbara", "/s/HOMELY-KITCHEN", "/s/barbaras", "/s/homely-kitchen-2", "/s/barbara/foo", "/s/barbara/p", "/s/barbara/p/", "/s/barbara/p/prd_1/extra", "/chat/barbara/extra", "/marketplace", "/"]) {
      assert.equal(await hit(path), "continues", path);
    }
  });

  it("the full lifecycle, including a rollback AFTER the new URL was already shared", async () => {
    // 0. code deployed, record not yet renamed: the old URL serves, and a new URL that someone already holds still works
    await addShop({ slug: OLD, name: OLD, staff: [{ name: "Boomu" }] });
    assert.equal(await hit(`/s/${OLD}`), "continues");
    assert.deepEqual(await hit(`/s/${NEW}/p/prd_7`), redirectTo(`/s/${OLD}/p/prd_7`));

    // 1. the rename (the exact statement from the README): both directions flip
    assert.equal((await renameShop(OLD, { slug: NEW, name: "Homely Kitchen" })).length, 1);
    assert.equal(await hit(`/s/${NEW}`), "continues");
    assert.deepEqual(await hit(`/s/${OLD}/p/prd_7`), redirectTo(`/s/${NEW}/p/prd_7`));

    // 2. the new URL gets shared, then the rename is rolled back
    assert.equal((await renameShop(NEW, { slug: OLD, name: OLD })).length, 1);
    assert.deepEqual(await hit(`/s/${NEW}/p/prd_7`), redirectTo(`/s/${OLD}/p/prd_7`), "the shared new link still reaches the shop");
    assert.deepEqual(await hit(`/chat/${NEW}${QUERY}`), redirectTo(`/chat/${OLD}${QUERY}`));
    assert.equal(await hit(`/s/${OLD}`), "continues");

    // 3. and forward again
    await renameShop(OLD, { slug: NEW, name: "Homely Kitchen" });
    assert.deepEqual(await hit(`/s/${OLD}`), redirectTo(`/s/${NEW}`));

    // 4. the shop is removed entirely: nothing is invented
    await removeShop(NEW);
    assert.equal(await hit(`/s/${OLD}`), "continues");
    assert.equal(await hit(`/s/${NEW}`), "continues");
  });

  it("GET and HEAD give the same answer, a refresh repeats it, and POST keeps its method semantics (308)", async () => {
    await addShop({ slug: NEW, name: "Homely Kitchen", staff: [{ name: "Boomu" }] });
    const first = await hit("/s/barbara");
    assert.deepEqual(await hit("/s/barbara", "HEAD"), first);
    assert.deepEqual(await hit("/s/barbara"), first);
    assert.deepEqual(await hit("/s/barbara", "POST"), first);
  });

  it("follows at most one hop in every state, so no loop is possible", async () => {
    const follow = async (path: string): Promise<number> => {
      let hops = 0;
      let current = path;
      for (; hops < 10; hops++) {
        const out = await hit(current);
        if (out === "continues") return hops;
        current = new URL(out.location as string).pathname + new URL(out.location as string).search;
      }
      return hops;
    };
    for (const state of [{ slug: OLD, name: OLD }, { slug: NEW, name: "Homely Kitchen" }]) {
      await resetShops();
      await addShop({ ...state, staff: [{ name: "Boomu" }] });
      for (const path of ["/s/barbara", "/s/homely-kitchen", "/s/barbara/p/prd_1", "/s/homely-kitchen/p/prd_1", `/chat/barbara${QUERY}`, `/chat/homely-kitchen${QUERY}`]) {
        assert.ok((await follow(path)) <= 1, `${state.slug}: ${path}`);
      }
    }
  });

  it("keeps the product id and the raw query string byte for byte, including encoded characters", async () => {
    await addShop({ slug: NEW, name: "Homely Kitchen", staff: [{ name: "Boomu" }] });
    assert.deepEqual(await hit("/s/barbara/p/prd_%41%2Fb-_9?x=%20a&y=1&y=2&z"), redirectTo("/s/homely-kitchen/p/prd_%41%2Fb-_9?x=%20a&y=1&y=2&z"));
    assert.deepEqual(await hit("/s/barbara/p/..%2f..%2fadmin"), redirectTo("/s/homely-kitchen/p/..%2f..%2fadmin"));
  });

  it("trailing slash: planned redirect drops it (Next normalises it first, see the real-server check)", () => {
    assert.equal(planSlugRedirect("/s/barbara/")?.pathname, "/s/homely-kitchen");
    assert.equal(planSlugRedirect("/s/homely-kitchen/p/prd_1/")?.pathname, "/s/barbara/p/prd_1");
    assert.equal(planSlugRedirect("/s/barbara//"), null);
  });

  it("never sends the visitor anywhere but the same site: a hostile product segment cannot change the origin", async () => {
    await addShop({ slug: NEW, name: "Homely Kitchen", staff: [{ name: "Boomu" }] });
    for (const segment of ["%5C%5Cevil.example", "%2F%2Fevil.example", "https:%2F%2Fevil.example", "@evil.example"]) {
      const out = await hit(`/s/barbara/p/${segment}`);
      if (out !== "continues") assert.equal(new URL(out.location as string).origin, ORIGIN, segment);
    }
  });
});

describe("decideSlugRedirect (pure decision table)", () => {
  const lookupOf = (existing: string[]) => async (slugs: readonly string[]) => slugs.filter((s) => existing.includes(s));
  const table: [string[], string, string][] = [
    [[NEW], "/s/barbara", "redirect"],
    [[OLD], "/s/homely-kitchen", "redirect"],
    [[OLD], "/s/barbara", "serve:requested-exists"],
    [[NEW], "/s/homely-kitchen", "serve:requested-exists"],
    [[OLD, NEW], "/s/barbara", "conflict"],
    [[OLD, NEW], "/s/homely-kitchen", "conflict"],
    [[], "/s/barbara", "serve:neither-exists"],
    [["lotus-handloom"], "/s/homely-kitchen", "serve:neither-exists"],
    [[NEW], "/s/lotus-handloom", "serve:not-an-alias-url"],
  ];
  for (const [existing, path, expected] of table) {
    it(`database [${existing.join(", ")}] and ${path} -> ${expected}`, async () => {
      const d = await decideSlugRedirect(path, "", lookupOf(existing));
      assert.equal(d.action === "serve" ? `serve:${d.reason}` : d.action, expected);
    });
  }
});

describe("registry and matcher", () => {
  it("is well formed: no slug appears twice, no pair maps a slug to itself, slugs are valid and at most 40 characters", () => {
    const all = SLUG_ALIASES.flatMap((a) => [a.from, a.to]);
    assert.equal(new Set(all).size, all.length);
    for (const { from, to } of SLUG_ALIASES) {
      assert.notEqual(from, to);
      for (const slug of [from, to]) assert.match(slug, /^[a-z0-9]+(-[a-z0-9]+)*$/);
      assert.ok(from.length <= 40 && to.length <= 40);
    }
  });

  const expected = SLUG_ALIASES.flatMap((a) => [a.from, a.to]).flatMap((slug) => [`/s/${slug}`, `/s/${slug}/p/:id`, `/chat/${slug}`]);
  it("proxy.ts matcher lists exactly the three URL shapes of both slugs of every pair", () => {
    assert.deepEqual([...config.matcher].sort(), [...expected].sort());
  });

  it("Next's own matcher agrees: the proxy runs for those URLs and for nothing else", async () => {
    (globalThis as { AsyncLocalStorage?: unknown }).AsyncLocalStorage = AsyncLocalStorage;
    const specifier = "next/experimental/testing/server.js";
    const mod = await import(specifier);
    const matches: (input: { config: unknown; nextConfig: unknown; url: string }) => boolean = (mod.default ?? mod).unstable_doesMiddlewareMatch;
    const runs = (url: string) => matches({ config, nextConfig: {}, url });
    for (const slug of [OLD, NEW]) for (const url of [`/s/${slug}`, `/s/${slug}/p/prd_Yi3Ya4RmuQ03`, `/chat/${slug}`]) assert.equal(runs(url), true, url);
    for (const url of ["/s/barbara-2", "/s/barbara-2/p/prd_1", "/chat/barbara-2", "/s/homely-kitchen-2", "/s/Barbara", "/s/HOMELY-KITCHEN", "/s/lotus-handloom", "/chat/lotus-handloom", "/api/public/sellers/barbara", "/api/public/sellers/homely-kitchen", "/seller/homely-kitchen", "/marketplace", "/login", "/"]) {
      assert.equal(runs(url), false, url);
    }
  });
});
