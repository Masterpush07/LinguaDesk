// Test-only stand-in for @neondatabase/serverless: the app's own lib/db.ts is used unchanged, but every query goes to an in-memory Postgres.
// Nothing here can reach a network, so a test can never touch a real database whatever DATABASE_URL says.
import { PGlite } from "@electric-sql/pglite";

let instance: Promise<PGlite> | null = null;
export const testPg = (): Promise<PGlite> => (instance ??= PGlite.create());

type Row = Record<string, unknown>;
const run = async (text: string, params: unknown[] = []): Promise<Row[]> => (await (await testPg()).query<Row>(text, params)).rows;

export function neon() {
  const sql = (strings: TemplateStringsArray, ...values: unknown[]) => run(strings.reduce((text, part, i) => text + part + (i < values.length ? `$${i + 1}` : ""), ""), values);
  sql.query = run;
  sql.transaction = async (queries: Promise<Row[]>[]) => Promise.all(queries);
  return sql;
}

export const neonConfig = {};
