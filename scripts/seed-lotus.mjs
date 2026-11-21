// Copies the original single-shop demo (Lotus Handloom) into the multi-shop platform as a normal shop, through the public
// sign-up and desk APIs, exactly as a real seller would create it. The old tables are only read, never changed.
// Run: node --env-file=.env.local scripts/seed-lotus.mjs [baseUrl] [--dry]
// Optional env: LOTUS_PASSCODE (otherwise a random one is printed once), LOTUS_OWNER, LOTUS_SHOP_NAME.
import { randomBytes } from "crypto";
import { neon } from "@neondatabase/serverless";

const args = process.argv.slice(2);
const dry = args.includes("--dry");
const base = args.find((a) => !a.startsWith("--")) ?? "http://localhost:3000";
const sql = neon(process.env.DATABASE_URL);

// The live shop info (including any edits made in /owner/shop) is the source, so nothing typed there is lost.
const [row] = await sql`SELECT data FROM shop_settings WHERE id = 1`;
if (!row) throw new Error("No shop_settings row found: nothing to copy.");
const old = row.data;

const shopName = process.env.LOTUS_SHOP_NAME ?? old.name;
const ownerName = process.env.LOTUS_OWNER ?? "Pushpanathan";
const passcode = process.env.LOTUS_PASSCODE ?? `${randomBytes(3).toString("hex")}-${randomBytes(3).toString("hex")}-${randomBytes(3).toString("hex")}`;
const slug = shopName.toLowerCase().replace(/[^a-z0-9]+/g, "-");

// Old products have no stock count, so in-stock items get a demo quantity and sold-out items get 0.
const CATEGORY = { "cotton-saree": "Sarees", "silk-cotton-saree": "Sarees", scarf: "Textiles", "tote-bag": "Bags", "cushion-cover": "Home decor", "table-runner": "Home decor" };
const products = old.products.map((p) => ({
  name: p.name,
  description: p.description,
  category: CATEGORY[p.id] ?? "Textiles",
  priceUsd: p.price,
  colors: p.colors,
  sizes: p.sizes,
  stock: p.inStock ? 25 : 0,
  active: true,
}));

const settings = {
  name: shopName,
  tagline: old.tagline,
  about: `Based in ${old.location}. ${old.contact}`.slice(0, 600),
  country: "India",
  languages: ["ta", "hi"],
  hours: old.hours,
  tone: "friendly",
  responseTargetMin: 15,
  shipping: old.shipping,
  policies: old.policies,
};
const glossary = [{ term: "Lotus Handloom", rule: "keep" }, { term: "saree", rule: "keep" }, { term: "zari", rule: "keep" }];

console.log(`Source: ${old.products.length} products, ${old.faqs.length} FAQs, ${Object.keys(old.policies).length} policies.`);
if (dry) {
  console.log("Dry run, nothing written. Would create:", { shopName, ownerName, slug, products: products.map((p) => `${p.name} $${p.priceUsd} x${p.stock} [${p.category}]`), faqs: old.faqs.length, settings });
  process.exit(0);
}

async function call(method, path, body, cookie) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(cookie ? { Cookie: cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { res, json: await res.json().catch(() => null) };
}

if ((await call("GET", `/api/public/sellers/${slug}`)).res.status === 200) {
  console.log(`${shopName} already exists at /s/${slug}. Nothing to do.`);
  process.exit(0);
}

// A deliberate one-off, so the per-network sign-up counter is cleared first (same as the demo seeding script).
await sql`DELETE FROM rate_events WHERE key LIKE 'signup:%'`;

const signup = await call("POST", "/api/auth/signup", { shopName, ownerName, passcode, country: settings.country, tagline: settings.tagline, languages: settings.languages });
if (!signup.res.ok) throw new Error(`Sign-up failed: ${signup.json?.error}`);
const cookie = signup.res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");

const put = await call("PUT", "/api/desk/settings", settings, cookie);
if (!put.res.ok) console.log("settings FAILED:", put.json?.error);
for (const p of products) {
  const r = await call("POST", "/api/desk/products", p, cookie);
  if (!r.res.ok) console.log(`product FAILED ${p.name}:`, r.json?.error);
}
for (const f of old.faqs) {
  const r = await call("POST", "/api/desk/faqs", f, cookie);
  if (!r.res.ok) console.log(`faq FAILED ${f.q}:`, r.json?.error);
}
for (const g of glossary) await call("POST", "/api/desk/glossary", g, cookie);

console.log(`\nCreated ${shopName} at /s/${signup.json.seller.slug}`);
if (!process.env.LOTUS_PASSCODE) {
  console.log("Sign-in details (shop name, your name, passcode). Keep them: the passcode is stored hashed and cannot be shown again.");
  console.log(`  ${shopName} | ${ownerName} | ${passcode}`);
}
