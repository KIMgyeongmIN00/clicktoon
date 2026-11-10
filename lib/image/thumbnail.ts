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

// 서버 업로드 전 압축: 서버리스 요청 본문 한도(~4.5MB) 안에 여러 장이 들어가도록
// 긴 변 기준 축소 + WebP 재인코딩. 실패하면 원본을 그대로 쓴다.
export async function compressForUpload(file: File, maxSize = 1600): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  try {
    const out = await makeThumbnail(file, maxSize, "image/webp", 0.88);
    if (out.size >= file.size) return file;
    const base = file.name.replace(/\.[^.]+$/, "") || "image";
    return new File([out], `${base}.webp`, { type: out.type });
  } catch {
    return file;
  }
}

// JSON이 아닌 응답(413/502 등)도 읽을 수 있는 메시지로 바꿔준다.
export async function readJsonOrThrow(r: Response): Promise<any> {
  const text = await r.text();
  try {
    return JSON.parse(text);
  } catch {
    if (r.status === 413)
      throw new Error("이미지 용량이 너무 큽니다. 장수를 줄이거나 작은 이미지로 올려주세요.");
    throw new Error(`서버 응답 오류 (${r.status})`);
  }
}
