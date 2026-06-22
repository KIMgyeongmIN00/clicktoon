"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Coins, LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useWallet } from "@/lib/credits/use-wallet";
import { browserSupabase } from "@/lib/supabase/browser";

// 내 계정. 크레딧 잔액은 아직 localStorage(테스트) — C3에서 서버 지갑으로 이관 예정.
export default function MyPage() {
  const { balance } = useWallet();
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    browserSupabase()
      .auth.getUser()
      .then(({ data }) => setEmail(data.user?.email ?? null));
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
              {balance.toLocaleString()}
            </span>
          </div>
          <Link href="/charge" className="block">
            <Button className="w-full">크레딧 충전하기</Button>
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
