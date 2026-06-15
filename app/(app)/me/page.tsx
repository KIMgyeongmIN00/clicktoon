"use client";
import Link from "next/link";
import { Coins, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useCredits } from "@/lib/credits/use-credits";

// API 키 설정은 제거됨 — AI는 서비스(서버 키)가 제공하고 사용자는 크레딧으로
// 이용합니다. 이 페이지는 추후 로그인 연동 시 "내 계정"으로 확장됩니다.
export default function MyPage() {
  const credits = useCredits();

  return (
    <main className="mx-auto w-full max-w-xl px-6 py-8">
      <h1 className="mb-6 text-xl font-semibold">마이페이지</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">내 크레딧</CardTitle>
          <p className="text-xs text-[var(--muted)]">
            크레딧으로 AI 이미지를 생성할 수 있어요.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
            <span className="flex items-center gap-2 text-sm text-[var(--muted)]">
              <Coins size={16} className="text-[var(--accent)]" /> 보유 크레딧
            </span>
            <span className="text-lg font-semibold tabular-nums">
              {credits.toLocaleString()}
            </span>
          </div>
          <Link href="/charge" className="block">
            <Button className="w-full">크레딧 충전하기</Button>
          </Link>
        </CardContent>
      </Card>

      <p className="mt-4 flex items-start gap-1.5 text-xs leading-relaxed text-[var(--muted)]">
        <Sparkles size={13} className="mt-0.5 shrink-0 text-[var(--accent)]" />
        로그인 기능은 준비 중이에요. 로그인하면 크레딧과 생성 기록이 계정에 안전하게
        저장됩니다. (현재 크레딧은 이 브라우저에만 임시 저장)
      </p>
    </main>
  );
}
