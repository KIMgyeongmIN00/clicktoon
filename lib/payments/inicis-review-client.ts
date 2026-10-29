"use client";

import { track } from "@/lib/analytics/browser";

declare global {
  interface Window {
    INIPayPro?: { requestPayment: (fields: Record<string, string>, closed: () => void) => void };
    jQuery?: unknown;
  }
}

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("결제창을 불러오지 못했습니다. 잠시 후 다시 시도해주세요."));
    document.head.appendChild(script);
  });
}

let loading: Promise<void> | undefined;
export async function openReviewPayment(planId: import("./plans").PlanId, closed: () => void) {
  loading ??= (async () => {
    if (!window.jQuery) await loadScript("https://paypro.inicis.com/std/payment/js/jquery-1.8.3.js");
    if (!window.INIPayPro) await loadScript("https://paypro.inicis.com/std/payment/js/INIPayPro_v2.js");
  })().catch((error) => { loading = undefined; throw error; });
  await loading;
  if (!window.INIPayPro) throw new Error("결제창을 불러오지 못했습니다.");
  const response = await fetch("/api/payments/inicis/prepare", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ planId }) });
  const fields = await response.json();
  if (!response.ok) throw new Error(fields.error ?? "테스트 주문을 만들지 못했습니다.");
  track("checkout_started", { order_id: fields.P_OID, amount: Number(fields.P_AMT), currency: "KRW" });
  window.INIPayPro.requestPayment(fields, closed);
}
