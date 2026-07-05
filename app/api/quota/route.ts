import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/supabase/session";
import { getQuota } from "@/lib/quota";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 현재 로그인 유저의 남은 무료 생성 횟수.
export async function GET() {
  const user = await getSessionUser();
  if (!user)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    return NextResponse.json(await getQuota(user.id));
  } catch (e) {
    console.error("[quota]", e);
    return NextResponse.json(
      { error: "내부 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
