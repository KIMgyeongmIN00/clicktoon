import { serverSupabase, signedUrl } from "@/lib/supabase/server";

// 워커가 결과를 직접 PUT 하도록 발급하는 업로드용 presigned URL.
// (워커는 장기 Storage 키 없이 이 URL로만 업로드 — SDD D2-B)
export async function signedUploadUrl(
  bucket: string,
  path: string,
): Promise<{ url: string; token: string; path: string }> {
  const sb = serverSupabase();
  const { data, error } = await sb.storage
    .from(bucket)
    .createSignedUploadUrl(path);
  if (error || !data)
    throw error ?? new Error("failed to create signed upload url");
  return { url: data.signedUrl, token: data.token, path: data.path };
}

// 워커가 레퍼런스/렌더를 GET 하도록 발급하는 다운로드용 presigned URL.
export function signedDownloadUrl(
  bucket: string,
  path: string,
  expiresInSec = 600,
): Promise<string> {
  return signedUrl(bucket, path, expiresInSec);
}
