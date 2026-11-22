import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { hashPasscode, newId } from "@/lib/v2/crypto";
import { normalizeRecoveryCode } from "@/lib/v2/recovery";
import { jar } from "./next-headers";
import { installSchema } from "./schema";

export type StaffSpec = { name: string; passcode?: string; role?: "owner" | "agent"; recovery?: string };
export type ShopSpec = { slug: string; name: string; staff?: StaffSpec[] };

let counter = 0;

// Empties the shop tables (cascades to everything that hangs off a shop) and the session jar, so every test starts from nothing.
export async function resetShops(): Promise<void> {
  await installSchema();
  // TRUNCATE ... CASCADE below is only ever allowed on the in-memory test database that tests/alias-loader.mjs swaps in.
  if (!/\.invalid\/test$/.test(process.env.DATABASE_URL ?? "")) throw new Error("resetShops refused: not the in-memory test database");
  await db()`TRUNCATE sellers, buyers, rate_events RESTART IDENTITY CASCADE`;
  jar.clear();
}

export async function addShop(spec: ShopSpec): Promise<{ sellerId: string; staffIds: Record<string, string> }> {
  counter++;
  const sellerId = newId("sel");
  await db()`INSERT INTO sellers (id, slug, shop_name, owner_name, nexconn_user_id) VALUES (${sellerId}, ${spec.slug}, ${spec.name}, ${spec.staff?.[0]?.name ?? "Owner"}, ${`s${counter}test`})`;
  const staffIds: Record<string, string> = {};
  for (const [i, s] of (spec.staff ?? []).entries()) {
    const id = newId("stf");
    staffIds[s.name] = id;
    await db()`INSERT INTO staff (id, seller_id, name, role, passcode_hash, recovery_hash) VALUES
      (${id}, ${sellerId}, ${s.name}, ${s.role ?? (i === 0 ? "owner" : "agent")}, ${await hashPasscode(s.passcode ?? "correct horse")}, ${s.recovery ? await hashPasscode(normalizeRecoveryCode(s.recovery)) : null})`;
  }
  return { sellerId, staffIds };
}

export const removeShop = (slug: string) => db()`DELETE FROM sellers WHERE slug = ${slug}`;
export const renameShop = (from: string, to: { slug: string; name: string }) => db()`UPDATE sellers SET slug = ${to.slug}, shop_name = ${to.name} WHERE slug = ${from} RETURNING slug`;

export async function post(route: (req: NextRequest) => Promise<Response>, path: string, body: unknown, ip = "203.0.113.7") {
  const res = await route(new NextRequest(`http://localhost${path}`, { method: "POST", headers: { "content-type": "application/json", "x-real-ip": ip }, body: JSON.stringify(body) }));
  return { status: res.status, json: (await res.json().catch(() => null)) as Record<string, unknown> | null };
}
