import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { CREDIT_PACK } from "@/lib/payments/packs";
import { getSessionUser } from "@/lib/supabase/session";
import { serverSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 결제창을 열기 전에 서버가 주문을 만든다.
//
// 금액을 클라이언트가 정하게 두면 requestPayment()에서 조작할 수 있다. 서버가
// 주문번호와 금액을 발급해 두고 승인 때 그 주문과 대조하는 것이 위변조를 막는
// 유일한 방법이다. 계정별 결제 내역이 남는 것도 여기서 시작된다.
export async function POST() {
  try {
    const user = await getSessionUser();
    if (!user)
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

    // 토스 orderId 규칙: 6~64자, 영문·숫자·`-`·`_`. nanoid의 문자셋이 그 안에 든다.
    const orderId = `credit_${nanoid(16)}`;

    const sb = serverSupabase();
    const ins = await sb.from("payment_orders").insert({
      order_id: orderId,
      user_id: user.id,
      pack_id: CREDIT_PACK.id,
      amount: CREDIT_PACK.amount,
      credits: CREDIT_PACK.credits,
      status: "pending",
    });
    if (ins.error) throw ins.error;

    return NextResponse.json({
      orderId,
      amount: CREDIT_PACK.amount,
      orderName: CREDIT_PACK.orderName,
      // 토스 customerKey 규칙: 2~50자 영문·숫자·`-_=.@`. uuid가 그 안에 든다.
      customerKey: user.id,
    });
  } catch (e) {
    console.error("[payments/orders]", e);
    return NextResponse.json(
      { error: "주문 생성에 실패했습니다." },
      { status: 500 },
    );
  }
}
