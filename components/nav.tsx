"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sparkles, User, Images, Wand2, LogIn, Gift } from "lucide-react";
import { browserSupabase } from "@/lib/supabase/browser";

const TABS = [
  { href: "/", label: "포즈 생성", icon: Wand2, exact: true },
  { href: "/characters", label: "캐릭터 모음", icon: Sparkles, exact: false },
  { href: "/gallery", label: "전체 갤러리", icon: Images, exact: false },
  { href: "/me", label: "마이페이지", icon: User, exact: false },
];

type Quota = {
  pose: { left: number };
  concept: { left: number };
};

export function Nav() {
  const pathname = usePathname();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [quota, setQuota] = useState<Quota | null>(null);

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
      {authed === false && (
        <Link
          href="/login"
          className="ml-auto flex shrink-0 items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-xs transition hover:border-[var(--accent)]/60"
        >
          <LogIn size={14} className="text-[var(--accent)]" />
          <span className="whitespace-nowrap">로그인</span>
        </Link>
      )}
      {authed && quota && (
        <span
          title="남은 무료 생성 (포즈 · 컨셉아트)"
          className="ml-auto flex shrink-0 items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-xs"
        >
          <Gift size={14} className="text-[var(--accent)]" />
          <span className="whitespace-nowrap tabular-nums text-[var(--muted)]">
            포즈 <b className="text-[var(--foreground)]">{quota.pose.left}</b> ·
            컨셉 <b className="text-[var(--foreground)]">{quota.concept.left}</b>
          </span>
        </span>
      )}
    </header>
  );
}
