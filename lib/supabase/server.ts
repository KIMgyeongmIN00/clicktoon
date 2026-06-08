import { createClient, SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

export function serverSupabase(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Supabase server credentials missing — set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local",
    );
  }
  cached = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return cached;
}

export const REF_BUCKET = "refs";
export const RESULT_BUCKET = "results";

export async function signedUrl(
  bucket: string,
  path: string,
  expiresInSec = 60 * 60,
): Promise<string> {
  const sb = serverSupabase();
  const { data, error } = await sb.storage
    .from(bucket)
    .createSignedUrl(path, expiresInSec);
  if (error || !data) throw error ?? new Error("Failed to sign url");
  return data.signedUrl;
}
