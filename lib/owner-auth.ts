import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

// Signed, httpOnly login cookie so owner API routes can tell the owner apart from a customer.
const COOKIE = "linguadesk_owner";
const MAX_AGE_SECONDS = 12 * 60 * 60;

// Keyed with the passcode, so changing the passcode also logs everyone out.
function sign(expires: string) {
  return createHmac("sha256", process.env.OWNER_PASSCODE ?? "").update(expires).digest("hex");
}

export async function setOwnerCookie() {
  const expires = String(Date.now() + MAX_AGE_SECONDS * 1000);
  (await cookies()).set(COOKIE, `${expires}.${sign(expires)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function clearOwnerCookie() {
  (await cookies()).delete(COOKIE);
}

export async function isOwner(): Promise<boolean> {
  if (!process.env.OWNER_PASSCODE) return false;
  const value = (await cookies()).get(COOKIE)?.value;
  const [expires, signature] = value?.split(".") ?? [];
  if (!expires || !signature || Number(expires) < Date.now()) return false;
  const expected = Buffer.from(sign(expires));
  const received = Buffer.from(signature);
  return expected.length === received.length && timingSafeEqual(expected, received);
}
