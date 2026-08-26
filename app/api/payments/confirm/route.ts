import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/supabase/session";
import { serverSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CONFIRM_URL = "https://api.tosspayments.com/v1/payments/confirm";

// 서버 권한 결제 승인. 클라이언트는 SDK로 결제를 **인증**만 하고, 실제 승인은
// 시크릿 키를 가진 여기서 확정한다.
export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user)
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

    const secretKey = process.env.TOSS_SECRET_KEY;
    if (!secretKey) {
      return NextResponse.json(
        { error: "TOSS_SECRET_KEY가 설정되지 않았습니다." },
        { status: 500 },
      );
    }

    const body = await req.json();
    const paymentKey = String(body.paymentKey ?? "");
    const orderId = String(body.orderId ?? "");
    const amount = Number(body.amount ?? 0);
    if (!paymentKey || !orderId || !amount) {
      return NextResponse.json(
        { error: "paymentKey, orderId, amount가 필요합니다." },
        { status: 400 },
      );
    }

    const sb = serverSupabase();

    // ── 주문 대조 ──
    // requestPayment()는 브라우저에서 실행되어 amount가 조작될 수 있다. 승인 전에
    // 서버가 발급해 둔 주문과 대조한다. 주문 소유자까지 확인해 남의 주문번호로
    // 승인을 시도하는 것도 막는다.
    const ordRes = await sb
      .from("payment_orders")
      .select("*")
      .eq("order_id", orderId)
      .maybeSingle();
    if (ordRes.error) throw ordRes.error;
    const order = ordRes.data;

    if (!order)
      return NextResponse.json(
        { error: "주문을 찾을 수 없습니다." },
        { status: 404 },
      );
    if (order.user_id !== user.id)
      return NextResponse.json(
        { error: "본인의 주문이 아닙니다." },
        { status: 403 },
      );
    if (order.amount !== amount)
      return NextResponse.json(
        { error: `결제 금액이 올바르지 않습니다. (주문 금액 ${order.amount}원)` },
        { status: 400 },
      );
    // 이미 승인된 주문이면 토스를 다시 부르지 않고 그대로 돌려준다(새로고침 대비).
    if (order.status === "paid")
      return NextResponse.json({
        ok: true,
        alreadyConfirmed: true,
        credited: order.credits,
        orderId: order.order_id,
        amount: order.amount,
        approvedAt: order.approved_at,
      });

    // Authorization: Basic base64(SECRET_KEY + ":") — 콜론을 빠뜨리면 인증 실패.
    const auth = Buffer.from(`${secretKey}:`).toString("base64");
    const res = await fetch(CONFIRM_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ paymentKey, orderId, amount }),
    });
    const data = await res.json();

    if (!res.ok) {
      // Toss 에러 응답: { code, message }
      await sb
        .from("payment_orders")
        .update({
          status: "failed",
          fail_code: data?.code ?? null,
          fail_message: data?.message ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq("order_id", orderId);
      return NextResponse.json(
        { error: data?.message ?? "결제 승인에 실패했습니다.", code: data?.code },
        { status: res.status },
      );
    }

    // 승인 성공 → 주문 확정
    await sb
      .from("payment_orders")
      .update({
        status: "paid",
        payment_key: paymentKey,
        method: data?.method ?? null,
        approved_at: data?.approvedAt ?? new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("order_id", orderId);

    // 크레딧 적립 (멱등: ref=paymentKey — 같은 결제로 두 번 적립되지 않는다)
    const topup = await sb.rpc("credit_topup", {
      p_user: user.id,
      p_amount: order.credits,
      p_ref: paymentKey,
    });
    if (topup.error) throw topup.error;

    return NextResponse.json({
      ok: true,
      credited: order.credits,
      balance: topup.data,
      orderId: data.orderId,
      amount: order.amount,
      method: data?.method ?? null,
      approvedAt: data?.approvedAt ?? null,
    });
  } catch (e) {
    console.error("[payments/confirm]", e);
    return NextResponse.json(
      { error: "내부 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
