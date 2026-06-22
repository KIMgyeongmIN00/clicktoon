"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CircleCheck, CircleAlert, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

type State = "pending" | "ok" | "error";

export default function ChargeSuccessPage() {
  return (
    <Suspense fallback={null}>
      <Confirm />
    </Suspense>
  );
}

function Confirm() {
  const sp = useSearchParams();
  const [state, setState] = useState<State>("pending");
  const [granted, setGranted] = useState(0);
  const [error, setError] = useState("");
  const ran = useRef(false);

  useEffect(() => {
    // 같은 마운트에서 중복 승인(이중 크레딧 적립)되지 않도록 1회만 실행.
    if (ran.current) return;
    ran.current = true;

    const paymentKey = sp.get("paymentKey");
    const orderId = sp.get("orderId");
    const amount = sp.get("amount");
    if (!paymentKey || !orderId || !amount) {
      setState("error");
      setError("결제 정보가 올바르지 않습니다.");
      return;
    }

    (async () => {
      try {
        const r = await fetch("/api/payments/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paymentKey, orderId, amount: Number(amount) }),
        });
        const json = await r.json();
        if (!r.ok) throw new Error(json.error ?? "결제 승인에 실패했습니다.");
        // 서버가 이미 지갑에 적립함(credit_topup). 클라는 표시만.
        setGranted(json.credited ?? 0);
        setState("ok");
      } catch (e) {
        setState("error");
        setError((e as Error).message);
      }
    })();
  }, [sp]);

  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-md flex-col items-center justify-center px-6 py-12 text-center">
      {state === "pending" && (
        <>
          <RefreshCw size={32} className="animate-spin text-[var(--muted)]" />
          <p className="mt-4 text-sm text-[var(--muted)]">결제를 승인하는 중…</p>
        </>
      )}

      {state === "ok" && (
        <>
          <CircleCheck size={40} className="text-[var(--accent)]" />
          <h1 className="mt-4 text-xl font-semibold">충전 완료</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            <span className="font-semibold text-[var(--foreground)]">
              +{granted} 크레딧
            </span>{" "}
            이 적립되었습니다.
          </p>
          <div className="mt-6 flex gap-2">
            <Link href="/">
              <Button>포즈 생성하러 가기</Button>
            </Link>
            <Link href="/charge">
              <Button variant="outline">더 충전하기</Button>
            </Link>
          </div>
        </>
      )}

      {state === "error" && (
        <>
          <CircleAlert size={40} className="text-[var(--danger)]" />
          <h1 className="mt-4 text-xl font-semibold">충전 실패</h1>
          <p className="mt-1 break-keep text-sm text-[var(--muted)]">{error}</p>
          <Link href="/charge" className="mt-6">
            <Button variant="outline">다시 시도</Button>
          </Link>
        </>
      )}
    </main>
  );
}
