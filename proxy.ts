import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { slugAliasProxy } from "@/lib/v2/slug-alias-proxy";

// Sends either address of a renamed shop (pairs in lib/v2/slug-aliases.ts) to the one the database holds, in both directions.
export function proxy(request: NextRequest) {
  return slugAliasProxy(request, async (slugs) => {
    const rows = await db()`SELECT slug FROM sellers WHERE slug = ANY(${[...slugs]})`;
    return rows.map((r) => r.slug as string);
  });
}

// Constants only (Next reads them at build time). A bare "/s/x" does not cover "/s/x/p/<id>", so each shape is listed for each slug.
// tests/slug-alias-redirect.test.ts keeps this list in step with SLUG_ALIASES.
export const config = {
  matcher: ["/s/barbara", "/s/barbara/p/:id", "/chat/barbara", "/s/homely-kitchen", "/s/homely-kitchen/p/:id", "/chat/homely-kitchen"],
};
