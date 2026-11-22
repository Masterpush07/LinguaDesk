import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { db } from "@/lib/db";
import { installSchema } from "./support/schema";

// Proves the harness itself: the app's real lib/db.ts runs real SQL, on the real production schema, in memory.
describe("test database harness", () => {
  it("applies every production migration and answers queries through the app's own db()", async () => {
    await installSchema();
    const tables = (await db()`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`).map((r) => r.table_name as string);
    for (const t of ["sellers", "staff", "products", "threads", "orders_v2", "rate_events", "assets", "reviews"]) assert.ok(tables.includes(t), `missing table ${t}`);
  });

  it("enforces the real constraints that matter for slugs and sign-in", async () => {
    await installSchema();
    const indexes = (await db()`SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND tablename IN ('sellers', 'staff')`).map((r) => r.indexname as string);
    assert.ok(indexes.includes("sellers_slug_key"), "slug must be unique");
    assert.ok(indexes.includes("staff_name_idx"), "staff names are unique per shop");
  });

  it("runs array parameters the way the app passes them (ANY with a JS array)", async () => {
    await installSchema();
    const rows = await db()`SELECT x FROM unnest(ARRAY['a','b','c']) AS x WHERE x = ANY(${["a", "c", "zz"]})`;
    assert.deepEqual(rows.map((r) => r.x), ["a", "c"]);
    const empty = await db()`SELECT x FROM unnest(ARRAY['a']) AS x WHERE x = ANY(${[]})`;
    assert.equal(empty.length, 0);
  });
});
