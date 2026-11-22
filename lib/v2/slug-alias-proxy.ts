import { decideSlugRedirect, type SlugLookup } from "@/lib/v2/slug-aliases";

// The page must never wait long for a redirect check: past this limit the request simply continues.
const LOOKUP_LIMIT_MS = 2000;

function within<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const limit = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`took longer than ${ms} ms`)), ms);
  });
  return Promise.race([work, limit]).finally(() => clearTimeout(timer));
}

// A real HTTP 308 sent before any page renders. Returning nothing lets the request continue to the normal route.
export async function slugAliasProxy(request: { url: string }, lookup: SlugLookup, limitMs = LOOKUP_LIMIT_MS): Promise<Response | undefined> {
  const url = new URL(request.url);
  try {
    const decision = await within(decideSlugRedirect(url.pathname, url.search, lookup), limitMs);
    if (decision.action === "conflict") {
      console.warn(`SLUG ALIAS CONFLICT: sellers "${decision.slugs[0]}" and "${decision.slugs[1]}" both exist, so ${url.pathname} is not redirected. They are meant to be one shop under one slug: rename or remove one of them.`);
    }
    if (decision.action !== "redirect") return undefined;
    // no-store keeps browsers from remembering the redirect, so a rename or its rollback takes effect on the next visit.
    return new Response(null, { status: 308, headers: { Location: new URL(decision.location, url).toString(), "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("slug alias redirect skipped (lookup failed):", err instanceof Error ? err.message : err);
    return undefined; // never redirect on a guess
  }
}
