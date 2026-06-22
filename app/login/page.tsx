"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Sparkles } from "lucide-react";
import { browserSupabase } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <Login />
    </Suspense>
  );
}

function Login() {
  const sp = useSearchParams();
  const error = sp.get("error");
  const [busy, setBusy] = useState(false);

  async function signIn() {
    setBusy(true);
    const sb = browserSupabase();
    const { error } = await sb.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) setBusy(false); // 성공 시 구글로 리다이렉트되어 여기로 안 돌아옴
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 px-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <Sparkles size={28} className="text-[var(--accent)]" />
        <h1 className="text-2xl font-semibold tracking-tight">클릭툰</h1>
        <p className="text-sm text-[var(--muted)]">
          로그인하고 AI 포즈 생성을 시작하세요
        </p>
      </div>
      <Button onClick={signIn} disabled={busy} className="min-w-56">
        {busy ? "이동 중…" : "Google로 계속하기"}
      </Button>
      {error && (
        <p className="text-xs text-[var(--danger)]">
          로그인에 실패했어요. 다시 시도해주세요.
        </p>
      )}
    </main>
  );
}
