// Wipes every conversation, message, order and rate-limit row so the demo starts clean (real traction, video recording).
// Customer chat history on Nexconn's side is untouched; only this app's database is emptied.
// Run: node --env-file=.env.local scripts/reset-demo.mjs --yes
import { neon } from "@neondatabase/serverless";

if (!process.argv.includes("--yes")) {
  console.log("This deletes ALL conversations, messages and orders from the database.");
  console.log("Run again with --yes to confirm:  node --env-file=.env.local scripts/reset-demo.mjs --yes");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);
const before = await sql`SELECT (SELECT count(*) FROM conversations)::int AS conversations, (SELECT count(*) FROM messages)::int AS messages, (SELECT count(*) FROM orders)::int AS orders`;
await sql`TRUNCATE orders, messages, conversations, webhook_events, rate_events RESTART IDENTITY`;
console.log("deleted:", before[0]);
