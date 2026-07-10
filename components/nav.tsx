"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sparkles, User, Images, Wand2, LogIn, Gift, Clapperboard } from "lucide-react";
import { browserSupabase } from "@/lib/supabase/browser";
import { isDemoUi } from "@/lib/demo-client";

const TABS = [
  { href: "/", label: "포즈 생성", icon: Wand2, exact: true },
  { href: "/characters", label: "캐릭터 모음", icon: Sparkles, exact: false },
  { href: "/gallery", label: "전체 갤러리", icon: Images, exact: false },
  { href: "/me", label: "마이페이지", icon: User, exact: false },
];

type Quota = {
  unlimited?: boolean;
  pose: { left: number };
  concept: { left: number };
};

export function Nav() {
  const pathname = usePathname();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [quota, setQuota] = useState<Quota | null>(null);
  const [demo, setDemo] = useState(false);

  useEffect(() => {
    setDemo(isDemoUi());
  }, [pathname]);

  useEffect(() => {
    let mounted = true;
    browserSupabase()
      .auth.getUser()
      .then(({ data }) => {
        if (!mounted) return;
        const isAuthed = !!data.user;
        setAuthed(isAuthed);
        if (isAuthed)
          fetch("/api/quota")
            .then((r) => (r.ok ? r.json() : null))
            .then((q) => mounted && setQuota(q))
            .catch(() => {});
      });
    return () => {
      mounted = false;
    };
  }, [pathname]);

  return (
    <header className="sticky top-0 z-30 flex items-center gap-3 overflow-x-auto border-b border-[var(--border)] bg-[var(--background)]/85 px-4 py-3 backdrop-blur sm:gap-6 sm:px-6">
      <Link
        href="/"
        className="shrink-0 whitespace-nowrap text-base font-semibold tracking-tight"
      >
        클릭툰
      </Link>
      <nav className="flex shrink-0 items-center gap-1 text-sm">
        {TABS.map((t) => {
          const active = t.exact
            ? pathname === t.href
            : pathname.startsWith(t.href);
          const Icon = t.icon;
          return (
            <Link
              key={t.href}
              href={t.href}
              className={[
                "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 transition",
                active
                  ? "bg-[var(--surface-2)] text-[var(--foreground)]"
                  : "text-[var(--muted)] hover:text-[var(--foreground)]",
              ].join(" ")}
            >
              <Icon size={15} />
              {t.label}
            </Link>
          );
        })}
      </nav>
      <div className="ml-auto flex shrink-0 items-center gap-2">
        {demo && (
          <span
            title="시연 모드 — 실제 AI 호출 없이 지정 이미지로 생성을 흉내냅니다"
            className="flex shrink-0 items-center gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-600 dark:text-amber-400"
          >
            <Clapperboard size={14} />
            <span className="whitespace-nowrap font-medium">시연 모드</span>
          </span>
        )}
        {authed === false && (
          <Link
            href="/login"
            className="flex shrink-0 items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-xs transition hover:border-[var(--accent)]/60"
          >
            <LogIn size={14} className="text-[var(--accent)]" />
            <span className="whitespace-nowrap">로그인</span>
          </Link>
        )}
        {authed && (quota || demo) && (
          <span
            title="남은 무료 생성 (포즈 · 컨셉아트)"
            className="flex shrink-0 items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-xs"
          >
            <Gift size={14} className="text-[var(--accent)]" />
            <span className="whitespace-nowrap tabular-nums text-[var(--muted)]">
              {demo || quota?.unlimited ? (
                <b className="text-[var(--foreground)]">무제한</b>
              ) : (
                <>
                  포즈{" "}
                  <b className="text-[var(--foreground)]">{quota!.pose.left}</b> ·
                  컨셉{" "}
                  <b className="text-[var(--foreground)]">
                    {quota!.concept.left}
                  </b>
                </>
              )}
            </span>
          </span>
        )}
      </div>
    </header>
  );
}
