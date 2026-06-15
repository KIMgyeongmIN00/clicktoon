"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sparkles, User, Images, Wand2, Coins } from "lucide-react";
import { useCredits } from "@/lib/credits/use-credits";

const TABS = [
  { href: "/", label: "포즈 생성", icon: Wand2, exact: true },
  { href: "/characters", label: "캐릭터 모음", icon: Sparkles, exact: false },
  { href: "/gallery", label: "전체 갤러리", icon: Images, exact: false },
  { href: "/me", label: "마이페이지", icon: User, exact: false },
];

export function Nav() {
  const pathname = usePathname();
  const credits = useCredits();
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
      <Link
        href="/charge"
        className="ml-auto flex shrink-0 items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-xs transition hover:border-[var(--accent)]/60"
      >
        <Coins size={14} className="text-[var(--accent)]" />
        <span className="tabular-nums font-medium">
          {credits.toLocaleString()}
        </span>
        <span className="text-[var(--muted)]">충전</span>
      </Link>
    </header>
  );
}
