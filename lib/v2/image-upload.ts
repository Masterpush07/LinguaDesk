"use client";

// Browser-side image preparation and upload. Images are shrunk before they are sent, so uploads stay small and fast.

const MAX_EDGE = 1200;
const TARGET_BYTES = 350 * 1024;

export type UploadKind = "product" | "chat" | "return";
export type UploadedImage = { id: string; url: string };

const toBlob = (canvas: HTMLCanvasElement, quality: number) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));

// Resizes to at most 1200 px on the longest side and re-encodes as JPEG, lowering quality until the file is small enough.
export async function compressImage(file: File): Promise<Blob> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error("Choose a JPEG, PNG or WebP image.");
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) throw new Error("This image could not be read. Try another file.");

  let scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  for (let attempt = 0; attempt < 6; attempt++) {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("This browser cannot prepare images for upload.");
    ctx.fillStyle = "#ffffff"; // JPEG has no transparency, so transparent PNG areas become white
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.85, 0.72, 0.6, 0.5]) {
      const blob = await toBlob(canvas, quality);
      if (blob && blob.size <= TARGET_BYTES) {
        bitmap.close();
        return blob;
      }
    }
    scale *= 0.8;
  }
  bitmap.close();
  throw new Error("This image is too large to upload. Choose a smaller image.");
}

export async function uploadImage(file: File, kind: UploadKind): Promise<UploadedImage> {
  const blob = await compressImage(file);
  const form = new FormData();
  form.append("file", new File([blob], "image.jpg", { type: "image/jpeg" }));
  form.append("kind", kind);
  const res = await fetch("/api/assets", { method: "POST", body: form });
  const body = (await res.json().catch(() => null)) as (UploadedImage & { error?: string }) | null;
  if (!res.ok || !body?.id) throw new Error(body?.error ?? `The image could not be uploaded (${res.status}).`);
  return { id: body.id, url: body.url };
}
