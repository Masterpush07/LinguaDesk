// Adds the shop-owned AI assistant (a name the owner can set) and in-app notifications for the shop.
// Additive and safe to re-run: nothing existing is changed or removed.
// Run with: node --env-file=.env scripts/migrate-v3.mjs
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

const statements = [
  // Empty means "use the default name", which is built from the shop name.
  `ALTER TABLE sellers ADD COLUMN IF NOT EXISTS agent_name text NOT NULL DEFAULT ''`,
  // Alerts shown in the shop's bell. Shared by everyone on the shop's team; read_at is set once someone has opened it.
  `CREATE TABLE IF NOT EXISTS notifications (
    id text PRIMARY KEY,
    seller_id text NOT NULL REFERENCES sellers (id) ON DELETE CASCADE,
    thread_id text REFERENCES threads (id) ON DELETE CASCADE,
    kind text NOT NULL,
    title text NOT NULL,
    body text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now(),
    read_at timestamptz
  )`,
  `CREATE INDEX IF NOT EXISTS notifications_seller_idx ON notifications (seller_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS notifications_unread_idx ON notifications (seller_id) WHERE read_at IS NULL`,
];

for (const statement of statements) await sql.query(statement);

const cols = await sql.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'sellers' AND column_name = 'agent_name'");
const tables = await sql.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'notifications'");
console.log("sellers.agent_name:", cols.length ? "present" : "MISSING", "| notifications table:", tables.length ? "present" : "MISSING");
