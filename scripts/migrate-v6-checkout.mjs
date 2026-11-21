// Adds checkout details: the shop's payment link and instructions, and each order's delivery address and paid time.
// Additive and safe to re-run: nothing existing is changed or removed.
// Run with: node --env-file=.env.local scripts/migrate-v6-checkout.mjs
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

const statements = [
  // The shop's own payment page and how-to-pay note. Payments go straight to the shop; LinguaDesk never touches the money.
  `ALTER TABLE sellers ADD COLUMN IF NOT EXISTS payment_link text NOT NULL DEFAULT ''`,
  `ALTER TABLE sellers ADD COLUMN IF NOT EXISTS payment_instructions text NOT NULL DEFAULT ''`,
  // Saved when the buyer confirms the order; paid_at is set by the shop when it has received the money.
  `ALTER TABLE orders_v2 ADD COLUMN IF NOT EXISTS delivery jsonb`,
  `ALTER TABLE orders_v2 ADD COLUMN IF NOT EXISTS paid_at timestamptz`,
];

for (const statement of statements) await sql.query(statement);

const found = await sql.query(
  `SELECT count(*)::int AS n FROM information_schema.columns
   WHERE (table_name = 'sellers' AND column_name IN ('payment_link', 'payment_instructions'))
      OR (table_name = 'orders_v2' AND column_name IN ('delivery', 'paid_at'))`,
);
console.log("checkout columns present:", found[0].n, "of 4");
