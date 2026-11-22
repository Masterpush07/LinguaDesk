// Shops whose slug changed. A pair is two addresses for ONE shop: whichever slug the database holds is the real one, and the other
// redirects to it, in either direction. Matching is exact: no case folding, no prefixes, no look-alikes.
export type SlugAlias = Readonly<{ from: string; to: string }>;

export const SLUG_ALIASES: readonly SlugAlias[] = [{ from: "barbara", to: "homely-kitchen" }];

// The other slug of the pair, or null when the slug is in no pair.
export function counterpartSlug(slug: string): string | null {
  for (const a of SLUG_ALIASES) {
    if (a.from === slug) return a.to;
    if (a.to === slug) return a.from;
  }
  return null;
}

// Both slugs of a pair are held back from new sign-ups.
export const isReservedSlug = (slug: string): boolean => counterpartSlug(slug) !== null;

// A reserved slug is still free for the shop that already holds one of the pair (it may rename itself to either name).
export function isSlugFreeFor(slug: string, ownSlug = ""): boolean {
  const other = counterpartSlug(slug);
  return other === null || ownSlug === slug || ownSlug === other;
}

// The slugs to look for given a slug (sign-in input goes through slugify first): itself, then the other slug of its pair.
export const slugCandidates = (slug: string): string[] => {
  const other = counterpartSlug(slug);
  return other === null ? [slug] : [slug, other];
};

export type RedirectPlan = { requested: string; counterpart: string; pathname: string };

// Recognises only /s/<slug>, /s/<slug>/p/<id> and /chat/<slug> for a slug that is in a pair, and returns the same path under the other slug.
export function planSlugRedirect(pathname: string): RedirectPlan | null {
  const parts = pathname.split("/");
  if (parts.length > 2 && parts.at(-1) === "") parts.pop(); // one trailing slash
  const [lead, area, requested, ...rest] = parts;
  if (lead !== "" || requested === undefined) return null;
  const counterpart = counterpartSlug(requested);
  if (counterpart === null) return null;
  const storefront = area === "s" && rest.length === 0;
  const product = area === "s" && rest.length === 2 && rest[0] === "p" && rest[1] !== "";
  const chat = area === "chat" && rest.length === 0;
  if (!storefront && !product && !chat) return null;
  parts[2] = counterpart;
  return { requested, counterpart, pathname: parts.join("/") };
}

export type SlugLookup = (slugs: readonly string[]) => Promise<readonly string[]>;

export type SlugRedirectDecision =
  | { action: "redirect"; location: string }
  | { action: "serve"; reason: "not-an-alias-url" | "requested-exists" | "neither-exists" }
  | { action: "conflict"; slugs: readonly [string, string] };

// Redirects only when the shop is really under the OTHER slug: the requested slug is gone and the other one exists.
// Both existing means two different shops, so nothing is redirected; neither existing leaves the normal not-found page.
export async function decideSlugRedirect(pathname: string, search: string, lookup: SlugLookup): Promise<SlugRedirectDecision> {
  const plan = planSlugRedirect(pathname);
  if (!plan) return { action: "serve", reason: "not-an-alias-url" };
  const found = new Set(await lookup([plan.requested, plan.counterpart]));
  const requested = found.has(plan.requested);
  const counterpart = found.has(plan.counterpart);
  if (requested && counterpart) return { action: "conflict", slugs: [plan.requested, plan.counterpart] };
  if (requested) return { action: "serve", reason: "requested-exists" };
  if (!counterpart) return { action: "serve", reason: "neither-exists" };
  return { action: "redirect", location: `${plan.pathname}${search}` };
}
