// One-off, safe to re-run: creates the tables if they do not exist. Run with: node --env-file=.env.local scripts/migrate.mjs
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

const statements = [
  // One row per customer chat. status 'ai' = the bot answers, 'human' = waiting for or handled by the owner.
  `CREATE TABLE IF NOT EXISTS conversations (
    customer_id text PRIMARY KEY,
    status text NOT NULL DEFAULT 'ai',
    language text,
    summary text,
    last_text text NOT NULL DEFAULT '',
    last_at timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  // sender is 'customer', 'ai' or 'owner'; text_en is the English version shown to the owner.
  `CREATE TABLE IF NOT EXISTS messages (
    id text PRIMARY KEY,
    customer_id text NOT NULL REFERENCES conversations (customer_id),
    sender text NOT NULL,
    text text NOT NULL,
    text_en text,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS messages_customer_idx ON messages (customer_id, created_at)`,
  // Nexconn retries webhooks, so each event ID is recorded once to stop duplicate bot replies.
  `CREATE TABLE IF NOT EXISTS webhook_events (
    id text PRIMARY KEY,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
];

for (const statement of statements) await sql.query(statement);

const tables = await sql.query(
  "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name",
);
console.log("tables now in the database:", tables.map((t) => t.table_name).join(", "));
