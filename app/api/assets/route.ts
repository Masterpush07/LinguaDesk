import { NextResponse, type NextRequest } from "next/server";
import { isLimited, recordEvent } from "@/lib/rate-limit";
import { assetUrl, MAX_ASSET_BYTES, saveAsset, sniffImage, type AssetKind } from "@/lib/v2/assets";
import { currentBuyerId, currentStaff } from "@/lib/v2/session";

const UPLOADS_PER_HOUR = 40;
const KINDS: AssetKind[] = ["product", "chat", "return"];

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

// Multipart upload with one "file" field and a "kind" field. Shop staff may upload product and chat images; buyers chat and return photos.
export async function POST(req: NextRequest) {
  const staff = await currentStaff();
  const buyerId = staff ? null : await currentBuyerId();
  if (!staff && !buyerId) return fail("Sign in or start a conversation before uploading an image.", 401);

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const kind = form?.get("kind");
  if (!(file instanceof File) || typeof kind !== "string" || !KINDS.includes(kind as AssetKind)) return fail("Send an image file and its kind.", 400);
  if (kind === "product" && !staff) return fail("Only the shop team can upload product images.", 403);
  if (kind === "return" && !buyerId) return fail("Return photos are uploaded by the buyer.", 403);
  if (file.size === 0) return fail("The image is empty.", 400);
  if (file.size > MAX_ASSET_BYTES) return fail("The image is too large. Choose a smaller image or try again.", 413);

  const actor = staff ? `staff:${staff.id}` : `buyer:${buyerId}`;
  const key = `asset:${actor}`;
  if (await isLimited(key, UPLOADS_PER_HOUR, 60)) return fail("You have uploaded many images. Please try again later.", 429);

  const buffer = Buffer.from(await file.arrayBuffer());
  const mime = sniffImage(buffer);
  if (!mime) return fail("Only JPEG, PNG and WebP images are accepted.", 415);

  await recordEvent(key);
  const id = await saveAsset({ sellerId: staff?.sellerId ?? null, buyerId, kind: kind as AssetKind, mime, buffer });
  return NextResponse.json({ id, url: assetUrl(id) }, { status: 201 });
}
