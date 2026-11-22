import { createHash } from "crypto";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { signToken, verifyToken } from "@/lib/v2/crypto";

// Server-only. Two kinds of signed httpOnly cookies: staff (owner or agent of one shop) and buyer (a guest chat identity).
const STAFF_COOKIE = "ld_staff";
const BUYER_COOKIE = "ld_buyer";
const STAFF_MAX_AGE = 12 * 60 * 60;
const BUYER_MAX_AGE = 90 * 24 * 60 * 60;

export type Staff = {
  id: string;
  sellerId: string;
  name: string;
  role: "owner" | "agent";
  languages: string[];
  sellerSlug: string;
  sellerName: string;
  nexconnUserId: string;
};

const cookieOptions = (maxAge: number) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge,
});

// Changes whenever the passcode does (every hash has a fresh salt), so a passcode change or recovery signs out every other device.
const stamp = (passcodeHash: string) => createHash("sha256").update(passcodeHash).digest("base64url").slice(0, 16);

export async function setStaffCookie(staffId: string) {
  const [row] = await db()`SELECT passcode_hash FROM staff WHERE id = ${staffId}`;
  if (!row) throw new Error("Cannot start a session for an unknown staff member");
  (await cookies()).set(STAFF_COOKIE, signToken({ s: staffId, v: stamp(row.passcode_hash as string) }, STAFF_MAX_AGE), cookieOptions(STAFF_MAX_AGE));
}
export async function clearStaffCookie() {
  // Cleared with the same attributes it was set with, so no browser treats this as a different cookie and keeps the session.
  (await cookies()).set(STAFF_COOKIE, "", { ...cookieOptions(0), expires: new Date(0) });
}

// Reads the signed cookie, then loads the live row, so removed staff or edited roles take effect immediately.
export async function currentStaff(): Promise<Staff | null> {
  const token = verifyToken<{ s: string; v?: string }>((await cookies()).get(STAFF_COOKIE)?.value);
  if (!token?.s) return null;
  const [row] = await db()`SELECT st.id, st.seller_id, st.name, st.role, st.languages, st.passcode_hash,
      s.slug, s.shop_name, s.nexconn_user_id
    FROM staff st JOIN sellers s ON s.id = st.seller_id WHERE st.id = ${token.s}`;
  if (!row || token.v !== stamp(row.passcode_hash as string)) return null;
  return {
    id: row.id,
    sellerId: row.seller_id,
    name: row.name,
    role: row.role,
    languages: row.languages,
    sellerSlug: row.slug,
    sellerName: row.shop_name,
    nexconnUserId: row.nexconn_user_id,
  };
}

export async function setBuyerCookie(buyerId: string) {
  (await cookies()).set(BUYER_COOKIE, signToken({ b: buyerId }, BUYER_MAX_AGE), cookieOptions(BUYER_MAX_AGE));
}
export async function currentBuyerId(): Promise<string | null> {
  return verifyToken<{ b: string }>((await cookies()).get(BUYER_COOKIE)?.value)?.b ?? null;
}
export async function clearBuyerCookie() {
  (await cookies()).set(BUYER_COOKIE, "", { ...cookieOptions(0), expires: new Date(0) });
}
