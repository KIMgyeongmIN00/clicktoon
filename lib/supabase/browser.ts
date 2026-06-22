"use client";
import { createBrowserClient } from "@supabase/ssr";

// 브라우저용 Supabase 클라이언트 (anon 키 + 쿠키 세션 — 서버와 세션 공유).
// 로그인/로그아웃·클라 세션 조회용. (SSR 인증을 위해 supabase-js createClient 대신 @supabase/ssr 사용)
export function browserSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
