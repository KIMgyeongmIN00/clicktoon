"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Sparkles, LogIn } from "lucide-react";
import { browserSupabase } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <Login />
    </Suspense>
  );
}

function Login() {
  const router = useRouter();
  const sp = useSearchParams();
  const oauthError = sp.get("error");

  // open-redirect 방지: same-origin 상대 경로만 허용 (OAuth 콜백과 같은 규칙).
  const nextRaw = sp.get("next") ?? "/";
  const next = nextRaw.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<"google" | "password" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function signInWithGoogle() {
    setBusy("google");
    setError(null);
    const { error } = await browserSupabase().auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (error) {
      setBusy(null); // 성공 시 구글로 리다이렉트되어 여기로 안 돌아옴
      setError("구글 로그인을 시작하지 못했어요. 잠시 후 다시 시도해주세요.");
    }
  }

  async function signInWithPassword(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy("password");
    setError(null);
    const { error } = await browserSupabase().auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) {
      setBusy(null);
      // 계정 존재 여부가 드러나지 않도록 사유를 구분하지 않는다.
      setError("이메일 또는 비밀번호가 올바르지 않아요.");
      return;
    }
    // 세션 쿠키가 서버에도 반영되도록 새로고침 후 이동.
    router.replace(next);
    router.refresh();
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-xs">
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          <Sparkles size={28} className="text-[var(--accent)]" />
          <h1 className="text-2xl font-semibold tracking-tight">클릭툰</h1>
          <p className="text-sm text-[var(--muted)]">
            로그인하고 AI 포즈 생성을 시작하세요
          </p>
        </div>

        <Button
          onClick={signInWithGoogle}
          disabled={!!busy}
          className="w-full"
        >
          {busy === "google" ? "이동 중…" : "Google로 계속하기"}
        </Button>

        <div className="my-5 flex items-center gap-3">
          <span className="h-px flex-1 bg-[var(--border)]" />
          <span className="text-[11px] text-[var(--muted)]">또는</span>
          <span className="h-px flex-1 bg-[var(--border)]" />
        </div>

        <form onSubmit={signInWithPassword} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs">
              이메일
            </Label>
            <Input
              id="email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-xs">
              비밀번호
            </Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          <Button
            type="submit"
            variant="outline"
            disabled={!!busy || !email || !password}
            className="w-full"
          >
            <LogIn size={15} />
            {busy === "password" ? "로그인 중…" : "이메일로 로그인"}
          </Button>
        </form>

        {(error || oauthError) && (
          <p className="mt-4 rounded-md border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 text-center text-xs text-[var(--danger)]">
            {error ?? "로그인에 실패했어요. 다시 시도해주세요."}
          </p>
        )}
      </div>
    </main>
  );
}
