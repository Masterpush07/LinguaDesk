import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { db } from "@/lib/db";
import { newId } from "@/lib/v2/crypto";
import { exportBuyerData } from "@/lib/v2/buyer-privacy";
import { productMeta, shopMeta, sitemapEntries } from "@/lib/v2/public-data";
import { productMetadata, storefrontMetadata } from "@/lib/v2/seo-metadata";
import { chatPath, productPath, storefrontPath } from "@/lib/v2/seller-paths";
import { buildSitemap } from "@/lib/v2/sitemap-build";
import { currentStaff } from "@/lib/v2/session";
import { addShop, renameShop, resetShops } from "./support/fixtures";
import { projectFile } from "./support/schema";
import { signInAs } from "./support/session";

const SITE = "https://shop.example";
const OLD = "barbara";
const NEW = "homely-kitchen";

async function addProduct(sellerId: string, name: string) {
  const id = newId("prd");
  await db()`INSERT INTO products (id, seller_id, name, description, category, price_usd, stock, active) VALUES (${id}, ${sellerId}, ${name}, 'Steamed idlis.', 'Food', 6, 10, true)`;
  return id;
}
const sitemapUrls = async () => buildSitemap(SITE, await sitemapEntries()).map((s) => s.url);

describe("sitemap, from the real query", () => {
  beforeEach(resetShops);

  it("after the rename it lists the new slug and its products, and not the old slug", async () => {
    const { sellerId } = await addShop({ slug: NEW, name: "Homely Kitchen", staff: [{ name: "Boomu" }] });
    const id = await addProduct(sellerId, "Idli box");
    const urls = await sitemapUrls();
    assert.ok(urls.includes(`${SITE}/s/${NEW}`));
    assert.ok(urls.includes(`${SITE}/s/${NEW}/p/${id}`));
    assert.equal(urls.some((u) => u.includes(`/${OLD}`)), false);
  });

  it("before the rename, or after a rollback, it lists the old slug and not the new one", async () => {
    const { sellerId } = await addShop({ slug: OLD, name: OLD, staff: [{ name: "Boomu" }] });
    const id = await addProduct(sellerId, "Idli box");
    const urls = await sitemapUrls();
    assert.ok(urls.includes(`${SITE}/s/${OLD}`));
    assert.ok(urls.includes(`${SITE}/s/${OLD}/p/${id}`));
    assert.equal(urls.some((u) => u.includes(NEW)), false);
  });

  it("a shop moving between the slugs is never listed twice and never lost", async () => {
    const { sellerId } = await addShop({ slug: OLD, name: OLD, staff: [{ name: "Boomu" }] });
    await addProduct(sellerId, "Idli box");
    for (const [from, to] of [[OLD, NEW], [NEW, OLD], [OLD, NEW]]) {
      await renameShop(from, { slug: to, name: to });
      const shops = (await sitemapUrls()).filter((u) => /\/s\/[^/]+$/.test(u));
      assert.deepEqual(shops, [`${SITE}/s/${to}`]);
    }
  });

  it("when both exist (two real shops) both are listed: the sitemap reports the database, it does not guess", async () => {
    await addShop({ slug: OLD, name: OLD, staff: [{ name: "Boomu" }] });
    await addShop({ slug: NEW, name: "Homely Kitchen", staff: [{ name: "Priya" }] });
    const urls = await sitemapUrls();
    assert.ok(urls.includes(`${SITE}/s/${OLD}`) && urls.includes(`${SITE}/s/${NEW}`));
  });

  it("other shops and the static pages are unchanged", async () => {
    await addShop({ slug: "lotus-handloom", name: "Lotus Handloom", staff: [{ name: "P" }] });
    const urls = await sitemapUrls();
    assert.deepEqual(urls, [SITE, `${SITE}/marketplace`, `${SITE}/sell`, `${SITE}/pricing`, `${SITE}/demo`, `${SITE}/privacy`, `${SITE}/s/lotus-handloom`]);
  });
});

describe("SEO metadata from the real lookups", () => {
  beforeEach(resetShops);
  const tagline = "Fresh homemade food, breakfast and evening snacks."; // a fixture value: nothing in the application holds it

  it("follows whichever slug the record holds: title and description from the record, canonical and og:url from its slug", async () => {
    const { sellerId } = await addShop({ slug: NEW, name: "Homely Kitchen", staff: [{ name: "Boomu" }] });
    await db()`UPDATE sellers SET tagline = ${tagline}, country = 'India' WHERE id = ${sellerId}`;
    const id = await addProduct(sellerId, "Idli box");

    const shop = storefrontMetadata((await shopMeta(NEW))!);
    assert.equal(shop.title, "Homely Kitchen · LinguaDesk");
    assert.equal(shop.description, tagline);
    assert.equal(shop.alternates?.canonical, `/s/${NEW}`);
    assert.equal(shop.openGraph?.url, `/s/${NEW}`);

    const product = productMetadata((await productMeta(NEW, id))!);
    assert.equal(product.title, "Idli box · Homely Kitchen · LinguaDesk");
    assert.equal(product.alternates?.canonical, `/s/${NEW}/p/${id}`);
    assert.equal(JSON.stringify([shop, product]).includes(OLD), false);

    await renameShop(NEW, { slug: OLD, name: OLD });
    assert.equal(storefrontMetadata((await shopMeta(OLD))!).alternates?.canonical, `/s/${OLD}`);
  });

  it("the other slug has no metadata of its own (the proxy redirects before a page renders)", async () => {
    await addShop({ slug: NEW, name: "Homely Kitchen", staff: [{ name: "Boomu" }] });
    assert.equal(await shopMeta(OLD), null);
  });

  it("falls back to the country text when the shop has no tagline and keeps the share image", () => {
    const meta = storefrontMetadata({ slug: NEW, name: "Homely Kitchen", text: "", country: "India", imageUrl: "https://img.example/a.jpg" });
    assert.equal(meta.description, "A shop in India on LinguaDesk. Ask your questions in your own language.");
    assert.equal((meta.twitter as { card?: string }).card, "summary_large_image");
  });
});

describe("links built from the record", () => {
  beforeEach(resetShops);

  it("paths use the slug they are given", () => {
    assert.equal(storefrontPath(NEW), "/s/homely-kitchen");
    assert.equal(productPath(NEW, "prd_Yi3Ya4RmuQ03"), "/s/homely-kitchen/p/prd_Yi3Ya4RmuQ03");
    assert.equal(chatPath(NEW), "/chat/homely-kitchen");
  });

  it("a signed-in session reads the live slug, so notification links change with the record and sessions stay valid", async () => {
    await addShop({ slug: OLD, name: OLD, staff: [{ name: "Boomu" }] });
    await signInAs(OLD, "Boomu");
    const before = await currentStaff();
    assert.equal(chatPath(before!.sellerSlug), "/chat/barbara");
    await renameShop(OLD, { slug: NEW, name: "Homely Kitchen" });
    const after = await currentStaff(); // the same cookie, no new sign-in
    assert.equal(after?.id, before?.id);
    assert.equal(after?.nexconnUserId, before?.nexconnUserId, "the chat identity is untouched");
    assert.equal(chatPath(after!.sellerSlug), "/chat/homely-kitchen");
    assert.equal(after?.sellerName, "Homely Kitchen");
  });

  it("the buyer's data export links to the shop under its current slug", async () => {
    const { sellerId } = await addShop({ slug: NEW, name: "Homely Kitchen", staff: [{ name: "Boomu" }] });
    const buyerId = "gtestbuyer0001";
    await db()`INSERT INTO buyers (id) VALUES (${buyerId})`;
    await db()`INSERT INTO threads (id, seller_id, buyer_id) VALUES (${newId("thr")}, ${sellerId}, ${buyerId})`;
    const data = await exportBuyerData(buyerId);
    assert.equal(data.conversations[0].shopLink, "/chat/homely-kitchen");
  });
});

describe("the exact SQL printed in the README", () => {
  const blocks = [...projectFile("README.md").matchAll(/```sql\r?\n([\s\S]*?)```/g)].map((m) => m[1].trim());
  const forward = blocks.find((b) => b.startsWith("UPDATE sellers") && b.includes("SET slug = 'homely-kitchen'"));
  const rollback = blocks.find((b) => b.startsWith("UPDATE sellers") && b.includes("SET slug = 'barbara'"));

  it("both statements are present in the README", () => {
    assert.ok(forward, "forward statement not found");
    assert.ok(rollback, "rollback statement not found");
  });

  it("run against the production schema: change four columns of exactly one row and nothing else, and the rollback restores them", async () => {
    await resetShops();
    const { sellerId, staffIds } = await addShop({ slug: OLD, name: OLD, staff: [{ name: "Boomu" }] });
    await db()`UPDATE sellers SET tagline = 'We sell home food', country = 'India', languages = ARRAY['en','ta','hi'] WHERE id = ${sellerId}`;
    await addShop({ slug: "lotus-handloom", name: "Lotus Handloom", staff: [{ name: "P" }] });
    const snapshot = async () => (await db()`SELECT to_jsonb(s) - 'slug' - 'shop_name' - 'tagline' - 'agent_name' AS rest, (SELECT count(*)::int FROM staff WHERE seller_id = s.id) AS staff FROM sellers s ORDER BY id`);
    const untouchedBefore = await snapshot();

    const done = await db().query(forward!);
    assert.equal(done.length, 1, "exactly one row");
    assert.deepEqual(done[0], { slug: NEW, shop_name: "Homely Kitchen", tagline: "Fresh homemade food, breakfast and evening snacks.", agent_name: "Homely Kitchen Assistant" });
    assert.deepEqual(await snapshot(), untouchedBefore, "no other column, row or staff member changed");
    const [row] = await db()`SELECT id, nexconn_user_id FROM sellers WHERE slug = ${NEW}`;
    assert.equal(row.id, sellerId);
    assert.ok(staffIds.Boomu);
    assert.equal((await db().query(forward!)).length, 0, "run twice it changes nothing");

    const undone = await db().query(rollback!);
    assert.equal(undone.length, 1);
    assert.deepEqual(undone[0], { slug: OLD, shop_name: OLD, tagline: "We sell home food", agent_name: "" });
    assert.deepEqual(await snapshot(), untouchedBefore);
  });

  it("refuses to touch anything if the record is not in the expected state (zero rows, no error)", async () => {
    await resetShops();
    await addShop({ slug: OLD, name: "Barbara Renamed In Settings", staff: [{ name: "Boomu" }] });
    assert.equal((await db().query(forward!)).length, 0);
  });

  it("fails loudly, changing nothing, if the new slug is already taken", async () => {
    await resetShops();
    await addShop({ slug: OLD, name: OLD, staff: [{ name: "Boomu" }] });
    await addShop({ slug: NEW, name: "Someone Else", staff: [{ name: "Priya" }] });
    await assert.rejects(() => db().query(forward!), /unique|duplicate/i);
    assert.equal((await db()`SELECT 1 FROM sellers WHERE slug = ${OLD}`).length, 1);
  });
});

describe("the names are not hard-coded outside the registry and the matcher", () => {
  const root = join(fileURLToPath(import.meta.url), "..", "..");
  const files = (dir: string) =>
    readdirSync(join(root, dir), { withFileTypes: true, recursive: true })
      .filter((e) => e.isFile() && /\.(ts|tsx)$/.test(e.name))
      .map((e) => relative(root, join(e.parentPath, e.name)).split(sep).join("/"));

  it("the slugs and the new shop name appear only in lib/v2/slug-aliases.ts and proxy.ts", () => {
    const allowed = new Set(["lib/v2/slug-aliases.ts", "proxy.ts"]);
    const offenders = ["app", "components", "lib"].flatMap(files).filter((f) => !allowed.has(f) && /barbara|homely-kitchen|Homely Kitchen/i.test(projectFile(f)));
    assert.deepEqual(offenders, []);
  });
});
