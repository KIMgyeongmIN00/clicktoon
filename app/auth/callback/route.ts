import { NextRequest, NextResponse } from "next/server";
import { sessionSupabase } from "@/lib/supabase/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// OAuth 리다이렉트 콜백 — 인가 코드를 세션으로 교환(쿠키 설정)하고 앱으로 보낸다.
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const next = req.nextUrl.searchParams.get("next") ?? "/";
  if (code) {
    const sb = await sessionSupabase();
    const { error } = await sb.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, req.url));
  }
  return NextResponse.redirect(new URL("/login?error=auth", req.url));
}
