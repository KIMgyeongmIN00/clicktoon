"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CreditCard } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { browserSupabase } from "@/lib/supabase/browser";
import { openReviewPayment } from "@/lib/payments/inicis-review-client";
import { SUBSCRIPTION_PLANS, type PlanId } from "@/lib/payments/plans";
import { track } from "@/lib/analytics/browser";

export default function ChargePage() {
  const [busy, setBusy] = useState(false);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    setResult(new URLSearchParams(window.location.search).get("review"));
    browserSupabase().auth.getUser().then(({ data }) => setAuthed(!!data.user));
  }, []);

  async function charge(planId: PlanId) {
    if (busy) return;
    setBusy(true);
    try {
      await openReviewPayment(planId, () => setBusy(false));
    } catch (error) {
      track("checkout_failed", {});
      toast.error((error as Error).message);
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-8">
      <h1 className="mb-2 text-xl font-semibold">구독 플랜</h1>
      <p className="mb-6 text-sm text-[var(--muted)]">월간 플랜 기준 상품입니다. 현재는 일회성 심사 테스트만 가능합니다.</p>
      <div className="mb-6 rounded-md border border-[var(--border)] bg-[var(--surface)] p-4 text-sm leading-relaxed">
        <strong>결제 연동 심사 안내</strong>
        <p className="mt-1">현재 버튼은 KG이니시스 일반 결제의 심사용 테스트입니다. 구독 등록, 자동 갱신 및 AI 이용 횟수 지급은 처리되지 않습니다. 테스트 카드도 실제 승인될 수 있으니 승인 및 취소 여부를 카드사에서 확인해주세요.</p>
      </div>
      {result && (
        <p role="status" className="mb-6 rounded-md border border-[var(--border)] bg-[var(--surface)] p-3 text-sm">
          {result === "success" ? "테스트 결제가 승인되었습니다. 구독 등록이나 이용 횟수 지급은 처리되지 않습니다." : result === "failed" ? "테스트 결제가 완료되지 않았습니다." : "결제 결과를 확인하지 못했습니다. 재결제하기 전에 카드 승인 내역을 확인해주세요."}
        </p>
      )}
      <div className="grid gap-4 md:grid-cols-3">
        {SUBSCRIPTION_PLANS.map((plan) => (
          <Card key={plan.id}>
            <CardHeader><CardTitle className="text-base">{plan.name}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p className="text-2xl font-semibold">₩{plan.amount.toLocaleString()}</p>
              <p className="text-sm text-[var(--muted)]">AI 기능 {plan.uses}회</p>
              {authed === false ? (
                <Link href="/login?next=%2Fcharge" className="block"><Button className="w-full"><CreditCard /> 로그인하고 테스트</Button></Link>
              ) : (
                <Button onClick={() => charge(plan.id)} disabled={busy || authed === null} className="w-full">
                  <CreditCard /> {busy ? "결제창 여는 중…" : "심사용 테스트 결제"}
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  );
}
