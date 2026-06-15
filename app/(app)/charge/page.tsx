"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Coins, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useCredits } from "@/lib/credits/use-credits";
import { CREDIT_PACK } from "@/lib/payments/packs";
import { requestCreditPayment, hasTossClientKey } from "@/lib/payments/toss";

export default function ChargePage() {
  const credits = useCredits();
  const [busy, setBusy] = useState(false);
  const keyReady = hasTossClientKey();

  async function charge() {
    if (busy) return;
    setBusy(true);
    try {
      // 성공 시 토스가 /charge/success로 리다이렉트하므로 보통 여기로 돌아오지 않습니다.
      await requestCreditPayment();
    } catch (e) {
      toast.error((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-xl px-6 py-8">
      <h1 className="mb-1 text-xl font-semibold">크레딧 충전</h1>
      <p className="mb-6 flex items-center gap-1.5 text-sm text-[var(--muted)]">
        <Coins size={15} className="text-[var(--accent)]" />
        현재 보유:{" "}
        <span className="font-semibold text-[var(--foreground)]">
          {credits.toLocaleString()} 크레딧
        </span>
      </p>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{CREDIT_PACK.orderName}</CardTitle>
          <p className="text-xs text-[var(--muted)]">
            {CREDIT_PACK.credits} 크레딧을 충전합니다.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-end justify-between rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
            <span className="flex items-center gap-2 text-sm">
              <Coins size={16} className="text-[var(--accent)]" />+
              {CREDIT_PACK.credits} 크레딧
            </span>
            <span className="text-lg font-semibold">
              ₩{CREDIT_PACK.amount.toLocaleString()}
            </span>
          </div>
          <Button onClick={charge} disabled={busy || !keyReady} className="w-full">
            <CreditCard /> {busy ? "결제창 여는 중…" : "결제하고 충전하기"}
          </Button>
        </CardContent>
      </Card>

      {!keyReady && (
        <p className="mt-4 rounded-md border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 text-xs text-[var(--danger)]">
          토스 클라이언트 키가 설정되지 않았습니다. <code>.env.local</code>의{" "}
          <code>NEXT_PUBLIC_TOSS_CLIENT_KEY</code>를 입력한 뒤 dev 서버를 재시작하세요.
        </p>
      )}

      <p className="mt-4 text-[11px] leading-relaxed text-[var(--muted)]">
        ※ 테스트 결제입니다. 토스 테스트 키 사용 시 실제로 청구되지 않습니다. 현재
        크레딧은 이 브라우저에만 임시 저장되며, 로그인·결제 연동이 완료되면 계정에
        귀속됩니다.
      </p>
    </main>
  );
}
