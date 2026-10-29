import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { getSessionUser } from "@/lib/supabase/session";
import { serverSupabase } from "@/lib/supabase/server";
import { findPlan } from "@/lib/payments/plans";
import { REVIEW_MID, REVIEW_PACK_ID, reviewHash } from "@/lib/payments/inicis-review";

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const body = await req.json().catch(() => null);
  const plan = findPlan(body?.planId);
  if (!plan) return NextResponse.json({ error: "올바른 플랜을 선택해주세요." }, { status: 400 });
  const orderId = `review_${nanoid(16)}`;
  const amount = plan.amount;
  const timestamp = String(Date.now());
  const origin = req.nextUrl.origin;
  const { error } = await serverSupabase().from("payment_orders").insert({
    order_id: orderId, user_id: user.id, pack_id: `${REVIEW_PACK_ID}-${plan.id}`,
    amount, credits: 0, status: "pending",
  });
  if (error) return NextResponse.json({ error: "테스트 주문을 만들지 못했습니다." }, { status: 500 });
  return NextResponse.json({
    P_MID: REVIEW_MID, P_OID: orderId, P_PAY_TYPE: "CARD", P_DEVICE_TYPE: "",
    P_IDCCODE: "Y", P_AMT: String(amount), P_GOODS: plan.name,
    P_UNAME: "클릭툰 고객", P_NEXT_URL: `${origin}/api/payments/inicis/return`,
    P_TIMESTAMP: timestamp, P_CHKFAKE: reviewHash(amount, orderId, timestamp),
    P_CHARSET: "UTF-8",
  });
}
