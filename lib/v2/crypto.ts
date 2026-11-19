import { createHmac, randomBytes, scrypt as scryptCb, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scrypt = promisify(scryptCb) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>;

// Server-only. Passcodes are stored as "salt:hash" (scrypt); the plain passcode is never saved.
export async function hashPasscode(passcode: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(passcode, salt, 32);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

export async function verifyPasscode(passcode: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = await scrypt(passcode, Buffer.from(saltHex, "hex"), expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

// SESSION_SECRET is preferred. Without it the key is derived from the Nexconn app secret, which is already private.
function secret(): string {
  const explicit = process.env.SESSION_SECRET;
  if (explicit) return explicit;
  const base = process.env.NEXCONN_APP_SECRET;
  if (!base) throw new Error("Missing env var SESSION_SECRET (or NEXCONN_APP_SECRET)");
  return `ld-session:${base}`;
}

const sign = (payload: string) => createHmac("sha256", secret()).update(payload).digest("base64url");

// Compact signed token: base64url(json).signature. The payload carries its own expiry.
export function signToken(data: Record<string, unknown>, maxAgeSeconds: number): string {
  const body = Buffer.from(JSON.stringify({ ...data, exp: Date.now() + maxAgeSeconds * 1000 })).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function verifyToken<T extends Record<string, unknown>>(token: string | undefined): (T & { exp: number }) | null {
  if (!token) return null;
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;
  const expected = Buffer.from(sign(body));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;
  try {
    const data = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as T & { exp: number };
    return typeof data.exp === "number" && data.exp > Date.now() ? data : null;
  } catch {
    return null;
  }
}

export const newId = (prefix: string) => `${prefix}_${randomBytes(9).toString("base64url")}`;

// Nexconn user IDs allow letters and digits only.
export const newNexconnId = (prefix: string) => `${prefix}${randomBytes(8).toString("hex")}`;

export const slugify = (name: string) =>
  name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
