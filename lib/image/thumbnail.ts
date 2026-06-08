"use client";

export async function makeThumbnail(
  file: File,
  maxSize = 512,
  mime = "image/webp",
  quality = 0.82,
): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas 2d unavailable");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();

  const blob: Blob = await new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
      mime,
      quality,
    ),
  );
  const ext = mime === "image/webp" ? "webp" : mime === "image/png" ? "png" : "jpg";
  return new File([blob], `thumb.${ext}`, { type: blob.type });
}
