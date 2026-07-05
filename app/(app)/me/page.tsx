"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Gift, LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { browserSupabase } from "@/lib/supabase/browser";

type Quota = {
  pose: { used: number; limit: number; left: number };
  concept: { used: number; limit: number; left: number };
};

// 내 계정 — 무료 쿼터 현황 표시 (결제 OFF 기간, PG 승인 후 크레딧으로 복귀 예정).
export default function MyPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [quota, setQuota] = useState<Quota | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    browserSupabase()
      .auth.getUser()
      .then(({ data }) => setEmail(data.user?.email ?? null));
    fetch("/api/quota")
      .then((r) => (r.ok ? r.json() : null))
      .then(setQuota)
      .catch(() => {});
  }, []);

  async function signOut() {
    setSigningOut(true);
    await browserSupabase().auth.signOut();
    router.push("/login");
  }

  return (
    <main className="mx-auto w-full max-w-xl px-6 py-8">
      <h1 className="mb-6 text-xl font-semibold">마이페이지</h1>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-base">계정</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2.5 rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm">
            <User size={16} className="text-[var(--accent)]" />
            <span className="truncate">{email ?? "—"}</span>
          </div>
          <Button
            variant="outline"
            onClick={signOut}
            disabled={signingOut}
            className="w-full"
          >
            <LogOut size={15} /> 로그아웃
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">무료 생성</CardTitle>
          <p className="text-xs text-[var(--muted)]">
            계정당 포즈 생성 2회 · 컨셉아트 1회를 무료로 제공해요.
          </p>
        </CardHeader>
        <CardContent className="space-y-2.5">
          {(
            [
              ["포즈 생성", quota?.pose],
              ["컨셉아트", quota?.concept],
            ] as const
          ).map(([label, q]) => (
            <div
              key={label}
              className="flex items-center justify-between rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
            >
              <span className="flex items-center gap-2 text-sm text-[var(--muted)]">
                <Gift size={16} className="text-[var(--accent)]" /> {label}
              </span>
              <span className="text-sm font-semibold tabular-nums">
                {q ? `${q.left}회 남음 (${q.used}/${q.limit} 사용)` : "—"}
              </span>
            </div>
          ))}
          <p className="pt-1 text-[11px] text-[var(--muted)]">
            결제 기능이 준비되면 추가 생성이 가능해져요.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
