import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/supabase/session";
import { getQuota, isUnlimitedEmail } from "@/lib/quota";
import { serverSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 현재 로그인 유저의 남은 무료 생성 횟수.
export async function GET() {
  const user = await getSessionUser();
  if (!user)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    if (isUnlimitedEmail(user.email))
      return NextResponse.json({
        unlimited: true,
        pose: { used: 0, limit: 0, left: 0 },
        concept: { used: 0, limit: 0, left: 0 },
      });
    const [quota, wallet] = await Promise.all([
      getQuota(user.id),
      serverSupabase().from("wallets").select("balance").eq("user_id", user.id).maybeSingle(),
    ]);
    if (wallet.error) throw wallet.error;
    return NextResponse.json({ unlimited: false, ...quota, paidLeft: wallet.data?.balance ?? 0 });
  } catch (e) {
    console.error("[quota]", e);
    return NextResponse.json(
      { error: "내부 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
