// Adds "unread" tracking for buyers: when the buyer last had each conversation open.
// Additive and safe to re-run: nothing existing is changed or removed.
// Run with: node --env-file=.env.local scripts/migrate-v9-unread.mjs
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

const statements = [
  `ALTER TABLE threads ADD COLUMN IF NOT EXISTS buyer_read_at timestamptz`,
  // Everything that exists today counts as already read, so no buyer sees a sudden pile of unread messages.
  `UPDATE threads SET buyer_read_at = now() WHERE buyer_read_at IS NULL`,
  `ALTER TABLE threads ALTER COLUMN buyer_read_at SET DEFAULT now()`,
];

for (const statement of statements) await sql.query(statement);

const found = await sql.query("SELECT count(*)::int AS n FROM threads WHERE buyer_read_at IS NULL");
console.log("threads without a read time:", found[0].n);
