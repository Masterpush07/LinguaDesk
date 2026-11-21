// Adds a cache for read-aloud audio, so a message is turned into speech once and replayed instantly afterwards.
// Additive and safe to re-run: nothing existing is changed or removed.
// Run with: node --env-file=.env.local scripts/migrate-v8-tts-cache.mjs
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

const statements = [
  // variant is 'shown' (the text in the buyer's language) or 'english'. Rows are small WAV files stored as base64 and dropped after a week.
  `CREATE TABLE IF NOT EXISTS tts_cache (
    message_id text NOT NULL,
    variant text NOT NULL CHECK (variant IN ('shown', 'english')),
    mime text NOT NULL,
    data text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (message_id, variant)
  )`,
  `CREATE INDEX IF NOT EXISTS tts_cache_created_idx ON tts_cache (created_at)`,
];

for (const statement of statements) await sql.query(statement);

const found = await sql.query("SELECT count(*)::int AS n FROM information_schema.tables WHERE table_name = 'tts_cache'");
console.log("tts_cache table:", found[0].n ? "present" : "MISSING");
