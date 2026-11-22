import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { db } from "@/lib/db";
import { newId } from "@/lib/v2/crypto";
import { countryAliases, normalizeCountry } from "@/lib/v2/country";
import { listProducts, listSellers, productMeta, shopMeta, sitemapEntries, sellerDetail } from "@/lib/v2/public-data";
import { loadContext, runSearch, type SearchIntent } from "@/lib/v2/smart-search";
import { productMetadata, storefrontMetadata } from "@/lib/v2/seo-metadata";
import { parseUnlisted } from "@/lib/v2/visibility";
import { typingThrottle } from "@/lib/v2/typing";
import { addShop, resetShops } from "./support/fixtures";

async function shopWith(slug: string, name: string, country: string, product: string) {
  const { sellerId } = await addShop({ slug, name, staff: [{ name: `${name} owner` }] });
  await db()`UPDATE sellers SET country = ${country} WHERE id = ${sellerId}`;
  const id = newId("prd");
  await db()`INSERT INTO products (id, seller_id, name, description, category, price_usd, stock, active) VALUES (${id}, ${sellerId}, ${product}, 'A thing.', 'Food', 6, 10, true)`;
  return id;
}

const intent = (over: Partial<SearchIntent> = {}): SearchIntent => ({ keywords: [], category: "", country: "", minPriceUsd: null, maxPriceUsd: null, inStockOnly: false, sort: "relevance", ai: false, ...over });

describe("country names", () => {
  it("one spelling for codes, names and informal names", () => {
    for (const raw of ["IN", "in", "india", " India ", "INDIA"]) assert.equal(normalizeCountry(raw), "India", raw);
    assert.equal(normalizeCountry("USA"), "United States");
    assert.equal(normalizeCountry("uk"), "United Kingdom");
    assert.equal(normalizeCountry("UAE"), "United Arab Emirates");
  });

  it("is idempotent, keeps unknown text and handles empty input", () => {
    for (const raw of ["India", "United States", "Narnia", "Bharat Nagar", "zz", ""]) assert.equal(normalizeCountry(normalizeCountry(raw)), normalizeCountry(raw), raw);
    assert.equal(normalizeCountry("Narnia"), "Narnia");
    assert.equal(normalizeCountry("zz"), "zz");
    assert.equal(normalizeCountry("   "), "");
  });

  it("aliases cover the stored spellings of one country", () => {
    const a = countryAliases("India");
    assert.ok(a.includes("india") && a.includes("in"));
    assert.deepEqual(countryAliases(""), []);
    assert.deepEqual(countryAliases("Narnia"), ["narnia"]);
  });
});

describe("unlisted shops", () => {
  const saved = process.env.MARKETPLACE_UNLISTED_SLUGS;
  beforeEach(resetShops);
  afterEach(() => {
    if (saved === undefined) delete process.env.MARKETPLACE_UNLISTED_SLUGS;
    else process.env.MARKETPLACE_UNLISTED_SLUGS = saved;
  });

  it("parses only exact slugs", () => {
    assert.deepEqual(parseUnlisted(" a-b, c ,a-b,,%,x*,Y"), ["a-b", "c"]);
    assert.deepEqual(parseUnlisted(undefined), []);
  });

  it("with the variable unset nothing changes", async () => {
    delete process.env.MARKETPLACE_UNLISTED_SLUGS;
    await shopWith("good-shop", "Good Shop", "India", "Idli");
    await shopWith("test-shop", "Test Shop", "India", "Dosa");
    assert.equal((await listSellers("", "")).length, 2);
    assert.equal((await listProducts("", "", "")).length, 2);
    assert.equal((await sitemapEntries()).shops.length, 2);
  });

  it("hides them from the directory, product grid, sitemap and search, but not from direct pages", async () => {
    await shopWith("good-shop", "Good Shop", "India", "Idli");
    const hiddenProduct = await shopWith("test-shop", "Test Shop", "India", "Dosa");
    process.env.MARKETPLACE_UNLISTED_SLUGS = "test-shop";

    assert.deepEqual((await listSellers("", "")).map((s) => s.slug), ["good-shop"]);
    assert.deepEqual((await listProducts("", "", "")).map((p) => p.name), ["Idli"]);
    const map = await sitemapEntries();
    assert.deepEqual(map.shops.map((s) => s.slug), ["good-shop"]);
    assert.deepEqual(map.products.map((p) => p.slug), ["good-shop"]);
    assert.deepEqual((await runSearch(intent())).products.map((p) => p.name), ["Idli"]);
    assert.deepEqual((await loadContext()).categories, ["Food"]);

    // Direct links, chat and sign-in still work, and the pages ask not to be indexed.
    assert.equal((await sellerDetail("test-shop"))?.seller.name, "Test Shop");
    const shop = await shopMeta("test-shop");
    assert.equal(shop?.listed, false);
    assert.deepEqual(storefrontMetadata(shop!).robots, { index: false, follow: false });
    const product = await productMeta("test-shop", hiddenProduct);
    assert.equal(product?.listed, false);
    assert.deepEqual(productMetadata(product!).robots, { index: false, follow: false });
    const normal = await shopMeta("good-shop");
    assert.equal(normal?.listed, true);
    assert.equal(storefrontMetadata(normal!).robots, undefined);
  });
});

describe("one country, one spelling", () => {
  beforeEach(resetShops);

  it("IN, india and India merge in filters, outputs and search choices", async () => {
    await shopWith("a-shop", "A Shop", "IN", "Idli");
    await shopWith("b-shop", "B Shop", "india", "Dosa");
    await shopWith("c-shop", "C Shop", "France", "Crepe");

    assert.equal((await listSellers("", "India")).length, 2);
    assert.equal((await listSellers("", "in")).length, 2);
    assert.deepEqual((await listSellers("", "")).map((s) => s.country).sort(), ["France", "India", "India"]);
    assert.equal((await listProducts("", "", "IN")).length, 2);
    assert.deepEqual((await loadContext()).countries, ["France", "India"]);
    assert.equal((await runSearch(intent({ country: "India" }))).products.length, 2);
    assert.equal((await sellerDetail("a-shop"))?.seller.country, "India");
  });
});

describe("typing throttle", () => {
  it("sends at most once per interval", () => {
    let t = 0;
    let sent = 0;
    const tick = typingThrottle(() => sent++, 3000, () => t);
    tick();
    t = 1000;
    tick();
    t = 2999;
    tick();
    assert.equal(sent, 1);
    t = 3000;
    tick();
    assert.equal(sent, 2);
  });
});
