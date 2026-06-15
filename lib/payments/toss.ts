"use client";
import { loadTossPayments, ANONYMOUS } from "@tosspayments/tosspayments-sdk";
import { nanoid } from "nanoid";
import { CREDIT_PACK } from "./packs";

const clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY;

export function hasTossClientKey(): boolean {
  return !!clientKey;
}

// Opens the Toss Standard Payment Window (결제창) for the credit pack.
// On success Toss redirects to /charge/success?paymentKey&orderId&amount,
// which then calls our server confirm API.
export async function requestCreditPayment(): Promise<void> {
  if (!clientKey) {
    throw new Error(
      "토스 클라이언트 키가 없습니다. .env.local의 NEXT_PUBLIC_TOSS_CLIENT_KEY를 설정하세요.",
    );
  }
  const tossPayments = await loadTossPayments(clientKey);
  // 로그인 전이라 비회원(ANONYMOUS) 결제. 로그인 연동 후 customerKey=유저 id로 교체.
  const payment = tossPayments.payment({ customerKey: ANONYMOUS });
  await payment.requestPayment({
    method: "CARD",
    amount: { currency: "KRW", value: CREDIT_PACK.amount },
    orderId: `credit_${nanoid(16)}`,
    orderName: CREDIT_PACK.orderName,
    successUrl: `${window.location.origin}/charge/success`,
    failUrl: `${window.location.origin}/charge/fail`,
  });
}
