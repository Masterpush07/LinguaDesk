import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { testPg } from "./neon-shim";

const root = join(fileURLToPath(import.meta.url), "..", "..", "..");

// Always overwritten (never "if unset"): db() only needs some value, and the driver behind it is the in-memory shim.
process.env.DATABASE_URL = "postgres://test:test@in-memory.invalid/test";
process.env.SESSION_SECRET = "test-only-signing-key";

// The real production migrations, in the order the README gives, run against the in-memory database.
const MIGRATIONS = [
  "migrate.mjs", "migrate-v2.mjs", "migrate-v3.mjs", "migrate-v4.mjs", "migrate-v5-buyer-email.mjs",
  "migrate-v6-checkout.mjs", "migrate-v7-translation-reports.mjs", "migrate-v8-tts-cache.mjs", "migrate-v9-unread.mjs", "migrate-v10-privacy.mjs",
];

let ready: Promise<void> | null = null;

export function installSchema(): Promise<void> {
  ready ??= (async () => {
    await testPg();
    const log = console.log;
    console.log = () => undefined; // the scripts print what they created
    try {
      for (const file of MIGRATIONS) await import(`../../scripts/${file}`);
    } finally {
      console.log = log;
    }
  })();
  return ready;
}

export const projectFile = (relative: string) => readFileSync(join(root, relative), "utf8");
