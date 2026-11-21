// Adds translation reports: a buyer can flag a message whose translation looks wrong, and the shop team reviews it.
// Additive and safe to re-run: nothing existing is changed or removed.
// Run with: node --env-file=.env.local scripts/migrate-v7-translation-reports.mjs
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

const statements = [
  // The texts are copied at report time, so the report still makes sense if the message is later changed or removed.
  `CREATE TABLE IF NOT EXISTS translation_reports (
    id text PRIMARY KEY,
    seller_id text NOT NULL REFERENCES sellers (id) ON DELETE CASCADE,
    thread_id text NOT NULL REFERENCES threads (id) ON DELETE CASCADE,
    buyer_id text NOT NULL REFERENCES buyers (id) ON DELETE CASCADE,
    message_id text NOT NULL,
    reason text NOT NULL,
    comment text NOT NULL DEFAULT '',
    sender text NOT NULL,
    original_text text NOT NULL,
    translated_text text NOT NULL,
    status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewed')),
    created_at timestamptz NOT NULL DEFAULT now(),
    reviewed_at timestamptz,
    UNIQUE (message_id, buyer_id)
  )`,
  `CREATE INDEX IF NOT EXISTS translation_reports_thread_idx ON translation_reports (thread_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS translation_reports_seller_idx ON translation_reports (seller_id, status)`,
];

for (const statement of statements) await sql.query(statement);

const found = await sql.query("SELECT count(*)::int AS n FROM information_schema.tables WHERE table_name = 'translation_reports'");
console.log("translation_reports table:", found[0].n ? "present" : "MISSING");
