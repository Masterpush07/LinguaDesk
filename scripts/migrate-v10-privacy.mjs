// Adds a "data deleted" time to buyers. The buyer row itself stays (as a random id with no personal details) so that shops keep their order records.
// Additive and safe to re-run: nothing existing is changed or removed.
// Run with: node --env-file=.env.local scripts/migrate-v10-privacy.mjs
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

await sql.query("ALTER TABLE buyers ADD COLUMN IF NOT EXISTS deleted_at timestamptz");

const found = await sql.query("SELECT count(*)::int AS n FROM information_schema.columns WHERE table_name = 'buyers' AND column_name = 'deleted_at'");
console.log("buyers.deleted_at:", found[0].n ? "present" : "MISSING");
