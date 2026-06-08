"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sparkles, User, Images, Wand2 } from "lucide-react";

const TABS = [
  { href: "/", label: "포즈 생성", icon: Wand2, exact: true },
  { href: "/characters", label: "캐릭터 모음", icon: Sparkles, exact: false },
  { href: "/gallery", label: "전체 갤러리", icon: Images, exact: false },
  { href: "/me", label: "마이페이지", icon: User, exact: false },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-30 flex items-center gap-6 border-b border-[var(--border)] bg-[var(--background)]/85 px-6 py-3 backdrop-blur">
      <Link href="/" className="text-base font-semibold tracking-tight">
        클릭툰
      </Link>
      <nav className="flex items-center gap-1 text-sm">
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
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 transition",
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
    </header>
  );
}
