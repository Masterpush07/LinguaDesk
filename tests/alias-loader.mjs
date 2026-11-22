// Lets `node --test` load the project's TypeScript as it is written: the "@/" alias and imports without a file extension.
// It also swaps in test doubles, so a test can never reach a real database: the Neon driver becomes an in-memory Postgres
// and next/headers becomes a plain cookie jar.
import { existsSync, statSync } from "node:fs";
import { dirname, join, resolve as resolvePath } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolvePath(dirname(fileURLToPath(import.meta.url)), "..");
const isFile = (path) => existsSync(path) && statSync(path).isFile();
const DOUBLES = {
  "@neondatabase/serverless": join(root, "tests", "support", "neon-shim.ts"),
  "next/headers": join(root, "tests", "support", "next-headers.ts"),
};

export async function resolve(specifier, context, nextResolve) {
  if (DOUBLES[specifier]) return nextResolve(pathToFileURL(DOUBLES[specifier]).href, context);
  if (specifier === "next/server") return nextResolve("next/server.js", context);
  let base;
  if (specifier.startsWith("@/")) base = join(root, specifier.slice(2));
  else if (specifier.startsWith(".") && context.parentURL?.startsWith("file:")) base = resolvePath(dirname(fileURLToPath(context.parentURL)), specifier);
  if (!base || base.includes("node_modules")) return nextResolve(specifier, context);
  for (const file of [base, `${base}.ts`, join(base, "index.ts")]) {
    if (isFile(file)) return nextResolve(pathToFileURL(file).href, context);
  }
  return nextResolve(specifier, context);
}
