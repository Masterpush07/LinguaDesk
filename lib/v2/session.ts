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

export async function setStaffCookie(staffId: string) {
  (await cookies()).set(STAFF_COOKIE, signToken({ s: staffId }, STAFF_MAX_AGE), cookieOptions(STAFF_MAX_AGE));
}
export async function clearStaffCookie() {
  (await cookies()).delete(STAFF_COOKIE);
}

// Reads the signed cookie, then loads the live row, so removed staff or edited roles take effect immediately.
export async function currentStaff(): Promise<Staff | null> {
  const token = verifyToken<{ s: string }>((await cookies()).get(STAFF_COOKIE)?.value);
  if (!token?.s) return null;
  const [row] = await db()`SELECT st.id, st.seller_id, st.name, st.role, st.languages,
      s.slug, s.shop_name, s.nexconn_user_id
    FROM staff st JOIN sellers s ON s.id = st.seller_id WHERE st.id = ${token.s}`;
  if (!row) return null;
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
