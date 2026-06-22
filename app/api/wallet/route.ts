import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/supabase/session";
import { serverSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 현재 로그인 유저의 크레딧 잔액.
export async function GET() {
  const user = await getSessionUser();
  if (!user)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sb = serverSupabase();
  const { data } = await sb
    .from("wallets")
    .select("balance")
    .eq("user_id", user.id)
    .maybeSingle();
  return NextResponse.json({ balance: data?.balance ?? 0 });
}
