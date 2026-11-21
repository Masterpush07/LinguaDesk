// Adds what reply emails need: when a buyer was last in the chat, and the buyer's confirmed email address.
// Additive and safe to re-run: nothing existing is changed or removed. (Replaces my earlier migrate-v4, which clashed with Boomika's.)
// Run with: node --env-file=.env.local scripts/migrate-v5-buyer-email.mjs
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

const statements = [
  // Updated while the buyer has the chat open, so a notification is only sent when they are away.
  `ALTER TABLE buyers ADD COLUMN IF NOT EXISTS last_seen timestamptz`,
  // An address only receives notifications after the owner of the inbox clicked the confirmation link.
  `CREATE TABLE IF NOT EXISTS buyer_emails (
    buyer_id text PRIMARY KEY REFERENCES buyers (id) ON DELETE CASCADE,
    email text NOT NULL,
    token text NOT NULL UNIQUE,
    verified_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
];

for (const statement of statements) await sql.query(statement);

const found = await sql.query(
  "SELECT (SELECT count(*)::int FROM information_schema.columns WHERE table_name = 'buyers' AND column_name = 'last_seen') AS last_seen, (SELECT count(*)::int FROM information_schema.tables WHERE table_name = 'buyer_emails') AS emails",
);
console.log("buyers.last_seen:", found[0].last_seen ? "present" : "MISSING", "| buyer_emails:", found[0].emails ? "present" : "MISSING");
