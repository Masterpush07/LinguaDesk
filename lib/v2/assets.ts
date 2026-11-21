import { db } from "@/lib/db";
import { newId } from "@/lib/v2/crypto";

// Server-only. Uploaded images are stored in the database as base64 text. The browser compresses them first (see lib/v2/image-upload.ts),
// so a typical image is a few hundred kilobytes and no separate storage service is needed.

export const MAX_ASSET_BYTES = 600 * 1024;
export type AssetKind = "product" | "chat" | "return";

const MAGIC: { mime: string; test: (b: Buffer) => boolean }[] = [
  { mime: "image/jpeg", test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: "image/png", test: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  { mime: "image/webp", test: (b) => b.length > 12 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP" },
];

// The real type comes from the file's first bytes, never from the name or the type the browser reports.
export function sniffImage(buffer: Buffer): string | null {
  return MAGIC.find((m) => m.test(buffer))?.mime ?? null;
}

export async function saveAsset(input: { sellerId?: string | null; buyerId?: string | null; kind: AssetKind; mime: string; buffer: Buffer }): Promise<string> {
  const id = newId("ast");
  await db()`INSERT INTO assets (id, seller_id, buyer_id, kind, mime, bytes, data)
    VALUES (${id}, ${input.sellerId ?? null}, ${input.buyerId ?? null}, ${input.kind}, ${input.mime}, ${input.buffer.length}, ${input.buffer.toString("base64")})`;
  return id;
}

export type StoredAsset = { id: string; seller_id: string | null; buyer_id: string | null; kind: AssetKind; mime: string; bytes: Buffer };

export async function loadAsset(id: string): Promise<StoredAsset | null> {
  const [row] = await db()`SELECT id, seller_id, buyer_id, kind, mime, data FROM assets WHERE id = ${id}`;
  if (!row) return null;
  return { id: row.id, seller_id: row.seller_id, buyer_id: row.buyer_id, kind: row.kind, mime: row.mime, bytes: Buffer.from(row.data, "base64") };
}

export const assetUrl = (id: string) => `/api/assets/${id}`;
export const ASSET_URL = /^\/api\/assets\/ast_[A-Za-z0-9_-]{6,40}$/;
