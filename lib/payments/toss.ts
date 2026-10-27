"use client";
import { loadTossPayments } from "@tosspayments/tosspayments-sdk";
import { track } from "@/lib/analytics/browser";

const clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY;

export function hasTossClientKey(): boolean {
  return !!clientKey;
}

type Order = {
  orderId: string;
  amount: number;
  orderName: string;
  customerKey: string;
};

// 토스 표준 결제창(결제창)을 연다.
//
// 주문번호·금액·customerKey는 **서버가 발급한 것만** 쓴다. 여기서 금액을 직접
// 정하면 브라우저에서 조작할 수 있고, 승인 단계에서 대조할 기준도 사라진다.
// customerKey는 로그인 유저 id라 결제가 계정에 귀속된다(비회원 결제 아님).
//
// 성공 시 토스가 /charge/success?paymentKey&orderId&amount 로 리다이렉트하고,
// 거기서 서버 승인 API를 호출해 결제가 최종 확정된다.
export async function requestCreditPayment(): Promise<void> {
  if (!clientKey) {
    throw new Error(
      "토스 클라이언트 키가 없습니다. .env.local의 NEXT_PUBLIC_TOSS_CLIENT_KEY를 설정하세요.",
    );
  }

  const r = await fetch("/api/payments/orders", { method: "POST" });
  const order = (await r.json()) as Order & { error?: string };
  if (!r.ok) throw new Error(order.error ?? "주문 생성에 실패했습니다.");

  const tossPayments = await loadTossPayments(clientKey);
  const payment = tossPayments.payment({ customerKey: order.customerKey });
  track("checkout_started", { order_id: order.orderId, amount: order.amount, currency: "KRW" });
  await payment.requestPayment({
    method: "CARD",
    amount: { currency: "KRW", value: order.amount },
    orderId: order.orderId,
    orderName: order.orderName,
    successUrl: `${window.location.origin}/charge/success`,
    failUrl: `${window.location.origin}/charge/fail`,
  });
}
