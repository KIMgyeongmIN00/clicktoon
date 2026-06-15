"use client";
import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CircleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ChargeFailPage() {
  return (
    <Suspense fallback={null}>
      <Fail />
    </Suspense>
  );
}

function Fail() {
  const sp = useSearchParams();
  const code = sp.get("code");
  const message = sp.get("message");

  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-md flex-col items-center justify-center px-6 py-12 text-center">
      <CircleAlert size={40} className="text-[var(--danger)]" />
      <h1 className="mt-4 text-xl font-semibold">결제가 취소되었어요</h1>
      <p className="mt-1 break-keep text-sm text-[var(--muted)]">
        {message ?? "결제가 완료되지 않았습니다."}
        {code ? ` (${code})` : ""}
      </p>
      <Link href="/charge" className="mt-6">
        <Button variant="outline">충전 페이지로</Button>
      </Link>
    </main>
  );
}
