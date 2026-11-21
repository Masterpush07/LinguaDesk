// Adds the tables and columns for: image uploads, owner recovery code, business hours, product selection in a chat,
// order cancellation, return requests, verified reviews, web push, continue-on-another-device links and cached exchange rates.
// Additive and safe to re-run: nothing existing is changed or removed.
// Run with: node --env-file=.env scripts/migrate-v4.mjs
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

const statements = [
  // Uploaded images live in the database as base64 text (compressed in the browser first), so no extra storage service is needed.
  `CREATE TABLE IF NOT EXISTS assets (
    id text PRIMARY KEY,
    seller_id text REFERENCES sellers (id) ON DELETE CASCADE,
    buyer_id text REFERENCES buyers (id) ON DELETE CASCADE,
    kind text NOT NULL DEFAULT 'image',
    mime text NOT NULL,
    bytes integer NOT NULL,
    data text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS assets_seller_idx ON assets (seller_id)`,
  `CREATE INDEX IF NOT EXISTS assets_buyer_idx ON assets (buyer_id)`,

  // Owner account recovery without email: a one-time recovery code shown at sign-up, stored only as a scrypt hash.
  `ALTER TABLE staff ADD COLUMN IF NOT EXISTS recovery_hash text`,

  // Structured weekly hours, e.g. {"mon":{"open":"09:00","close":"18:00"},"sun":null}. Empty object means "no hours set".
  `ALTER TABLE sellers ADD COLUMN IF NOT EXISTS business_hours jsonb NOT NULL DEFAULT '{}'::jsonb`,
  `ALTER TABLE sellers ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'UTC'`,
  `ALTER TABLE sellers ADD COLUMN IF NOT EXISTS away_message text NOT NULL DEFAULT ''`,

  // What the buyer picked on the product page, e.g. {"colour":"Maroon","qty":2}.
  `ALTER TABLE threads ADD COLUMN IF NOT EXISTS selection jsonb`,

  // Buyer-side order changes.
  `ALTER TABLE orders_v2 ADD COLUMN IF NOT EXISTS cancel_reason text`,
  `ALTER TABLE orders_v2 ADD COLUMN IF NOT EXISTS cancelled_at timestamptz`,
  `CREATE TABLE IF NOT EXISTS return_requests (
    id text PRIMARY KEY,
    order_id text NOT NULL REFERENCES orders_v2 (id) ON DELETE CASCADE,
    seller_id text NOT NULL REFERENCES sellers (id) ON DELETE CASCADE,
    buyer_id text NOT NULL REFERENCES buyers (id) ON DELETE CASCADE,
    reason text NOT NULL,
    details text NOT NULL DEFAULT '',
    photo_asset_id text REFERENCES assets (id) ON DELETE SET NULL,
    status text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'approved', 'rejected', 'refunded', 'closed')),
    seller_note text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS return_requests_seller_idx ON return_requests (seller_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS return_requests_order_idx ON return_requests (order_id)`,

  // One review per delivered order.
  `CREATE TABLE IF NOT EXISTS reviews (
    id text PRIMARY KEY,
    order_id text NOT NULL UNIQUE REFERENCES orders_v2 (id) ON DELETE CASCADE,
    seller_id text NOT NULL REFERENCES sellers (id) ON DELETE CASCADE,
    buyer_id text NOT NULL REFERENCES buyers (id) ON DELETE CASCADE,
    rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
    body text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS reviews_seller_idx ON reviews (seller_id, created_at DESC)`,

  // Web push. audience is 'staff' (the shop team) or 'buyer'. The endpoint is unique per browser.
  `CREATE TABLE IF NOT EXISTS push_subscriptions (
    id text PRIMARY KEY,
    audience text NOT NULL CHECK (audience IN ('staff', 'buyer')),
    seller_id text REFERENCES sellers (id) ON DELETE CASCADE,
    staff_id text REFERENCES staff (id) ON DELETE CASCADE,
    buyer_id text REFERENCES buyers (id) ON DELETE CASCADE,
    endpoint text UNIQUE NOT NULL,
    p256dh text NOT NULL,
    auth text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS push_subscriptions_seller_idx ON push_subscriptions (seller_id) WHERE audience = 'staff'`,
  `CREATE INDEX IF NOT EXISTS push_subscriptions_buyer_idx ON push_subscriptions (buyer_id) WHERE audience = 'buyer'`,

  // One-time links that carry a buyer's conversations and orders to another device.
  `CREATE TABLE IF NOT EXISTS device_links (
    id text PRIMARY KEY,
    buyer_id text NOT NULL REFERENCES buyers (id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL,
    used_at timestamptz
  )`,

  // Daily reference exchange rates (base USD), cached so no request waits on the rates provider.
  `CREATE TABLE IF NOT EXISTS fx_rates (
    id integer PRIMARY KEY CHECK (id = 1),
    rates jsonb NOT NULL,
    fetched_at timestamptz NOT NULL DEFAULT now()
  )`,

  // Remember which conversation an FAQ was learned from.
  `ALTER TABLE faqs ADD COLUMN IF NOT EXISTS source_thread_id text`,
];

for (const statement of statements) await sql.query(statement);

const want = ["assets", "return_requests", "reviews", "push_subscriptions", "device_links", "fx_rates"];
const tables = (await sql.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'")).map((t) => t.table_name);
const cols = await sql.query(
  `SELECT table_name || '.' || column_name AS c FROM information_schema.columns WHERE
   (table_name = 'staff' AND column_name = 'recovery_hash') OR (table_name = 'sellers' AND column_name IN ('business_hours', 'timezone', 'away_message'))
   OR (table_name = 'threads' AND column_name = 'selection') OR (table_name = 'orders_v2' AND column_name IN ('cancel_reason', 'cancelled_at'))
   OR (table_name = 'faqs' AND column_name = 'source_thread_id')`,
);
console.log("tables:", want.map((t) => `${t}:${tables.includes(t) ? "ok" : "MISSING"}`).join(" "));
console.log("columns added:", cols.map((r) => r.c).sort().join(", "));
