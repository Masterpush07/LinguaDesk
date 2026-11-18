import { db } from "@/lib/db";
import { DEFAULT_SHOP } from "@/lib/shop-defaults";
import { validateShop, type ShopData } from "@/lib/shop-data";

// Server-only. The shop info lives in one database row. A short in-memory cache avoids a database read on every chat message;
// other server instances pick up an edit within TTL_MS.
const TTL_MS = 10_000;
let cached: { shop: ShopData; at: number } | null = null;

export async function getShop(): Promise<ShopData> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.shop;
  try {
    const rows = await db()`SELECT data FROM shop_settings WHERE id = 1`;
    let shop = DEFAULT_SHOP;
    if (rows.length === 0) {
      await db()`INSERT INTO shop_settings (id, data) VALUES (1, ${JSON.stringify(DEFAULT_SHOP)}::jsonb) ON CONFLICT DO NOTHING`;
    } else {
      const checked = validateShop(rows[0].data);
      if (checked.ok) shop = checked.shop;
      else
        console.error(
          "Stored shop info is invalid, using the demo shop:",
          checked.errors.join(" "),
        );
    }
    cached = { shop, at: Date.now() };
    return shop;
  } catch (err) {
    console.error(
      "shop info read failed:",
      err instanceof Error ? err.message : err,
    );
    return cached?.shop ?? DEFAULT_SHOP; // the chat keeps working from the last known (or demo) info
  }
}

export async function saveShop(shop: ShopData): Promise<void> {
  await db()`INSERT INTO shop_settings (id, data, updated_at) VALUES (1, ${JSON.stringify(shop)}::jsonb, now())
    ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`;
  cached = { shop, at: Date.now() };
}
