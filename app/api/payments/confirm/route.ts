import { NextRequest, NextResponse } from "next/server";
import { CREDIT_PACK } from "@/lib/payments/packs";
import { getSessionUser } from "@/lib/supabase/session";
import { serverSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CONFIRM_URL = "https://api.tosspayments.com/v1/payments/confirm";

// Server-authoritative payment confirmation. The client only AUTHENTICATES the
// payment via the SDK; the payment is finalized here with the secret key.
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

    // ── 결제 금액 위변조 검증 ──
    // requestPayment()는 브라우저에서 실행되어 amount가 조작될 수 있습니다.
    // 승인 전에 반드시 서버가 의도한 금액과 일치하는지 확인해야 합니다.
    // 지금은 DB가 없어 유효한 팩 가격과만 대조합니다.
    // TODO(orders): 로그인·DB 연동 후 orderId로 저장한 주문 금액과 비교하세요.
    if (amount !== CREDIT_PACK.amount) {
      return NextResponse.json(
        { error: `결제 금액이 올바르지 않습니다. (기대값 ${CREDIT_PACK.amount}원)` },
        { status: 400 },
      );
    }

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
      return NextResponse.json(
        { error: data?.message ?? "결제 승인에 실패했습니다.", code: data?.code },
        { status: res.status },
      );
    }

    // 승인 성공 → 서버 지갑에 적립(멱등: ref=paymentKey).
    // TODO(orders): 승인 결과(paymentKey/orderId/amount/status/approvedAt)도 저장.
    const sb = serverSupabase();
    const topup = await sb.rpc("credit_topup", {
      p_user: user.id,
      p_amount: CREDIT_PACK.credits,
      p_ref: paymentKey,
    });
    if (topup.error) throw topup.error;

    return NextResponse.json({
      ok: true,
      credited: CREDIT_PACK.credits,
      balance: topup.data,
      orderId: data.orderId,
    });
  } catch (e) {
    console.error("[payments/confirm]", e);
    return NextResponse.json(
      { error: "내부 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
