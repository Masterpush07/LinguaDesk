import { NextResponse, type NextRequest } from "next/server";

// Server-only helpers shared by the seller-studio routes under /api/desk.

export const LIMITS = {
  productName: 60,
  productDescription: 300,
  productCategory: 40,
  productMax: 200,
  imageUrl: 500,
  faqQuestion: 200,
  faqAnswer: 500,
  faqMax: 50,
  glossaryTerm: 60,
  glossaryNote: 200,
  glossaryMax: 200,
  cannedTitle: 60,
  cannedBody: 500,
  cannedMax: 50,
  inviteMax: 20,
} as const;

export const fail = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

export async function readJson(req: NextRequest): Promise<Record<string, unknown> | null> {
  const body: unknown = await req.json().catch(() => null);
  return body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
}

export const invalidBody = () => fail("The request body must be a JSON object.");

// Collects every problem so the user sees all of them at once instead of one per attempt.
export class Check {
  readonly errors: string[] = [];

  text(value: unknown, label: string, max: number, required = false): string {
    const s = typeof value === "string" ? value.trim() : "";
    if (value !== undefined && value !== null && typeof value !== "string") this.errors.push(`${label} must be text.`);
    if (required && !s) this.errors.push(`${label} is required.`);
    if (s.length > max) {
      this.errors.push(`${label} must be at most ${max} characters.`);
      return s.slice(0, max);
    }
    return s;
  }

  whole(value: unknown, label: string, min: number, max: number): number {
    const n = typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value) : NaN;
    if (!Number.isInteger(n) || n < min || n > max) {
      this.errors.push(`${label} must be a whole number from ${min} to ${max}.`);
      return min;
    }
    return n;
  }

  words(value: unknown, label: string, maxItems: number, maxLength: number): string[] {
    if (value !== undefined && value !== null && !Array.isArray(value)) {
      this.errors.push(`${label} must be a list.`);
      return [];
    }
    const items = ((value as unknown[] | undefined) ?? [])
      .map((x) => (typeof x === "string" ? x.trim() : ""))
      .filter(Boolean);
    const unique = Array.from(new Set(items));
    if (unique.length > maxItems || unique.some((x) => x.length > maxLength)) {
      this.errors.push(`${label}: at most ${maxItems} items of ${maxLength} characters each.`);
    }
    return unique.slice(0, maxItems).map((x) => x.slice(0, maxLength));
  }

  languages(value: unknown, label: string, requireEnglish: boolean): string[] {
    if (value !== undefined && value !== null && !Array.isArray(value)) {
      this.errors.push(`${label} must be a list of two-letter language codes.`);
      return requireEnglish ? ["en"] : [];
    }
    const raw = ((value as unknown[] | undefined) ?? []).map((x) => (typeof x === "string" ? x.trim().toLowerCase() : ""));
    if (raw.some((x) => !/^[a-z]{2}$/.test(x))) this.errors.push(`${label} must be two-letter language codes such as en or es.`);
    const codes = Array.from(new Set([...(requireEnglish ? ["en"] : []), ...raw.filter((x) => /^[a-z]{2}$/.test(x))]));
    if (codes.length > 12) this.errors.push(`${label}: at most 12 languages.`);
    if (raw.length === 0) this.errors.push(`${label}: choose at least one language.`);
    return codes.slice(0, 12);
  }

  oneOf<T extends string>(value: unknown, label: string, allowed: readonly T[]): T {
    if (typeof value !== "string" || !allowed.includes(value as T)) {
      this.errors.push(`${label} must be one of: ${allowed.join(", ")}.`);
      return allowed[0];
    }
    return value as T;
  }

  imageUrl(value: unknown): string | null {
    if (value === undefined || value === null) return null;
    if (typeof value !== "string") {
      this.errors.push("Image URL must be text.");
      return null;
    }
    const s = value.trim();
    if (!s) return null;
    if (s.length > LIMITS.imageUrl) {
      this.errors.push(`Image URL must be at most ${LIMITS.imageUrl} characters.`);
      return null;
    }
    try {
      const url = new URL(s);
      if (url.protocol === "http:" || url.protocol === "https:") return s;
    } catch {
      // falls through to the error below
    }
    this.errors.push("Image URL must start with http:// or https://.");
    return null;
  }

  get ok() {
    return this.errors.length === 0;
  }

  get response() {
    return fail(this.errors.join(" "));
  }
}

// Browsers send their IANA zone so "today" and daily buckets follow the seller's own midnight. Anything invalid falls back to UTC.
export function timeZoneFrom(req: NextRequest): string {
  const tz = req.nextUrl.searchParams.get("tz");
  if (!tz || tz.length > 60) return "UTC";
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return tz;
  } catch {
    return "UTC";
  }
}

export const buyerLabel = (buyerId: string) => `Customer ${buyerId.slice(-6)}`;

export const iso = (value: unknown): string | null => {
  if (value instanceof Date) return value.toISOString();
  return typeof value === "string" ? new Date(value).toISOString() : null;
};
