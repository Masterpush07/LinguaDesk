// Creates four demo shops through the public sign-up and desk APIs, exactly as a real seller would.
// Run with the dev server up: node --env-file=.env scripts/seed-demo.mjs [baseUrl]
// Each shop gets a random passcode, printed once at the end. Existing shops (same slug) are skipped.
import { randomBytes } from "crypto";
import { neon } from "@neondatabase/serverless";

const base = process.argv[2] ?? "http://localhost:3000";
const sql = neon(process.env.DATABASE_URL);

const SHOPS = [
  {
    shopName: "Bali Artisan Collective",
    ownerName: "Made Wirawan",
    country: "Indonesia",
    languages: ["es", "ja", "fr"],
    tagline: "Rattan, leather and woven goods made by Ubud workshops.",
    about: "A cooperative of 40 artisans in Ubud making bags, baskets and home decor by hand. Every piece is signed by its maker.",
    hours: "08:00 to 20:00 Bali time, every day",
    shipping: { freeAbove: 100, fee: 12, worldwideDays: "5 to 8 business days", domesticDays: "", notes: "Orders are packed within 2 business days. Import duties and taxes are paid by the buyer." },
    policies: { returns: "Returns are accepted within 14 days of delivery for unused items in their original condition. The buyer pays return shipping.", payment: "Card payment through a secure link sent in this conversation after the order is confirmed.", customOrders: "Custom sizes and colours are possible for orders of 5 or more pieces and take about 3 weeks.", discounts: "Prices are fixed. Orders above $100 ship free.", giftWrap: "Gift wrapping is free on request.", care: "Wipe leather with a dry cloth and keep rattan away from prolonged moisture." },
    products: [
      { name: "Rattan-woven leather sling bag", category: "Bags", description: "Vegetable-tanned leather with a hand-woven rattan panel. Adjustable strap and an inner zip pocket.", priceUsd: 68, colors: ["Tan", "Dark brown"], stock: 14, imageUrl: "https://images.unsplash.com/photo-1527383214149-cb7be04ae387?crop=entropy&cs=srgb&fm=jpg&q=85" },
      { name: "Rattan market basket", category: "Home decor", description: "A sturdy open-weave basket for market or beach. 38 cm wide.", priceUsd: 38, colors: ["Natural"], stock: 22 },
    ],
    faqs: [
      { q: "Are the products handmade?", a: "Yes. Every piece is made by hand by artisans in Ubud." },
      { q: "Do you ship internationally?", a: "Yes. We ship worldwide and delivery takes 5 to 8 business days." },
    ],
    glossary: [{ term: "Bali Artisan Collective", rule: "keep" }],
  },
  {
    shopName: "Kigali Craft Works",
    ownerName: "Aline Uwase",
    country: "Rwanda",
    languages: ["fr", "ar"],
    tagline: "Hand-woven grass baskets by Rwandan weaving cooperatives.",
    about: "Women-led weaving cooperatives around Kigali. Baskets are dyed with natural pigments and woven over several days.",
    hours: "09:00 to 18:00 Kigali time, Monday to Saturday",
    shipping: { freeAbove: 80, fee: 10, worldwideDays: "7 to 12 business days", domesticDays: "", notes: "A tracking number is shared in this conversation when the parcel ships." },
    policies: { returns: "Returns are accepted within 21 days of delivery for unused items.", payment: "Card payment through a secure link sent in this conversation.", customOrders: "Custom colour combinations are available on request and take about 4 weeks.", discounts: "Prices are fixed.", giftWrap: "Gift wrapping is available for a small fee. Ask in the conversation.", care: "Spot clean with a damp cloth. Keep out of direct sunlight." },
    products: [
      { name: "Woven grass storage baskets, set of 3", category: "Home decor", description: "Three nesting lidded baskets in natural dyes, woven by Rwandan cooperatives.", priceUsd: 42, colors: ["Multicolour", "Red and black"], stock: 9, imageUrl: "https://images.unsplash.com/photo-1751725154557-b10ab73f1564?crop=entropy&cs=srgb&fm=jpg&q=85" },
      { name: "Agaseke peace basket", category: "Home decor", description: "The traditional conical gift basket with a lid, about 20 cm tall.", priceUsd: 29, colors: ["Red and black", "Natural"], stock: 17 },
    ],
    faqs: [
      { q: "Who makes the baskets?", a: "Women-led weaving cooperatives around Kigali." },
      { q: "How long does delivery take?", a: "Delivery takes 7 to 12 business days worldwide." },
    ],
    glossary: [{ term: "Agaseke", rule: "keep" }],
  },
  {
    shopName: "Kyoto Dye Studio",
    ownerName: "Haruka Mori",
    country: "Japan",
    languages: ["ja", "zh", "ko"],
    tagline: "Plant-dyed silk and cotton yarn from a Kyoto family studio.",
    about: "Three generations of natural dyers. Colours come from indigo, madder and persimmon, and every batch is slightly different.",
    hours: "10:00 to 18:00 Japan time, Tuesday to Sunday",
    shipping: { freeAbove: 90, fee: 9, worldwideDays: "4 to 7 business days", domesticDays: "", notes: "Shipped with tracking by Japan Post EMS." },
    policies: { returns: "Unopened spools can be returned within 14 days of delivery.", payment: "Card payment through a secure link sent in this conversation.", customOrders: "Custom dye colours are available for orders of 10 or more spools.", discounts: "Prices are fixed.", giftWrap: "Gift wrapping is free.", care: "Wash dyed items separately in cold water. Colours may soften slightly over time." },
    products: [
      { name: "Botanical-dyed silk and cotton spools", category: "Textiles", description: "A set of six spools in indigo, madder, persimmon, tea, iron and undyed. Silk and cotton blend.", priceUsd: 35, colors: ["Six-colour set"], stock: 31, imageUrl: "https://images.unsplash.com/photo-1474128670149-7082a8d370ea?crop=entropy&cs=srgb&fm=jpg&q=85" },
      { name: "Indigo hand-dyed tenugui cloth", category: "Textiles", description: "A thin cotton hand towel dyed in indigo vats. 35 cm by 90 cm.", priceUsd: 14, colors: ["Indigo", "Light indigo"], stock: 0 },
    ],
    faqs: [
      { q: "Are the dyes natural?", a: "Yes. All colours come from plants and minerals, and each batch varies slightly." },
      { q: "How long does shipping take?", a: "Worldwide shipping takes 4 to 7 business days." },
    ],
    glossary: [{ term: "Tenugui", rule: "keep" }, { term: "Kyoto Dye Studio", rule: "keep" }],
  },
  {
    shopName: "Arita Kilns",
    ownerName: "Kenji Arai",
    country: "Japan",
    languages: ["ja", "ko", "zh", "es"],
    tagline: "Minimalist stoneware and porcelain from Arita.",
    about: "A small kiln in Saga prefecture carrying on Arita-yaki techniques. Glazes are mixed in the studio and fired in wood and gas kilns.",
    hours: "09:00 to 17:00 Japan time, Monday to Friday",
    shipping: { freeAbove: 0, fee: 15, worldwideDays: "6 to 10 business days", domesticDays: "", notes: "Every parcel is insured and packed to protect ceramics." },
    policies: { returns: "Returns are accepted only for breakage in transit, reported within 7 days with photos.", payment: "Card payment through a secure link sent in this conversation.", customOrders: "Engraving and custom glazes are possible. Ask in the conversation for availability and price.", discounts: "Prices are fixed.", giftWrap: "Gift boxes are available. Ask in the conversation.", care: "Dishwasher and microwave safe. Avoid sudden temperature changes." },
    products: [
      { name: "Glazed stoneware tea set", category: "Tableware", description: "A teapot and four cups in a matte celadon glaze. 600 ml teapot.", priceUsd: 89, colors: ["Celadon", "Charcoal"], stock: 6, imageUrl: "https://images.pexels.com/photos/4452603/pexels-photo-4452603.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940" },
      { name: "Porcelain sake cup pair", category: "Tableware", description: "Two thin-walled porcelain cups with a hand-painted blue line.", priceUsd: 46, colors: ["White and blue"], stock: 12 },
    ],
    faqs: [
      { q: "Can items be shipped safely?", a: "Yes. Every parcel is insured and packed to protect ceramics." },
      { q: "Is the tea set dishwasher safe?", a: "Yes. The tea set is dishwasher and microwave safe." },
    ],
    glossary: [{ term: "Arita-yaki", rule: "keep" }],
  },
];

async function call(method, path, body, cookie) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(cookie ? { Cookie: cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  return { res, json };
}

// Sign-ups are limited to 5 per hour per network; a seeding run is a deliberate bulk action, so its own counter is cleared first.
await sql`DELETE FROM rate_events WHERE key LIKE 'signup:%'`;

const created = [];
for (const shop of SHOPS) {
  const slug = shop.shopName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  if ((await call("GET", `/api/public/sellers/${slug}`)).res.status === 200) {
    console.log(`skip ${shop.shopName}: already exists`);
    continue;
  }
  const passcode = `${randomBytes(3).toString("hex")}-${randomBytes(3).toString("hex")}-${randomBytes(3).toString("hex")}`;
  const signup = await call("POST", "/api/auth/signup", { shopName: shop.shopName, ownerName: shop.ownerName, passcode, country: shop.country, tagline: shop.tagline, languages: shop.languages });
  if (!signup.res.ok) {
    console.log(`FAILED ${shop.shopName}:`, signup.json?.error);
    continue;
  }
  const cookie = signup.res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
  const current = (await call("GET", "/api/desk/settings", null, cookie)).json;
  const put = await call("PUT", "/api/desk/settings", { ...current, about: shop.about, hours: shop.hours, shipping: shop.shipping, policies: shop.policies, tone: "neutral" }, cookie);
  if (!put.res.ok) console.log("  settings:", put.json?.error);
  for (const p of shop.products) {
    const r = await call("POST", "/api/desk/products", p, cookie);
    if (!r.res.ok) console.log(`  product ${p.name}:`, r.json?.error);
  }
  for (const f of shop.faqs) await call("POST", "/api/desk/faqs", f, cookie);
  for (const g of shop.glossary) await call("POST", "/api/desk/glossary", g, cookie);
  created.push({ shop: shop.shopName, owner: shop.ownerName, passcode, slug: signup.json.seller.slug });
  console.log(`created ${shop.shopName}`);
}

if (created.length) {
  console.log("\nSign-in details (shop name, your name, passcode). Keep them: passcodes are stored hashed and cannot be shown again.");
  for (const c of created) console.log(`  ${c.shop} | ${c.owner} | ${c.passcode} | /s/${c.slug}`);
}
