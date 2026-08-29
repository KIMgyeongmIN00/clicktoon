import Link from "next/link";

const BUSINESS = [
  { label: "대표", value: "윤세나" },
  { label: "사업자등록번호", value: "503-53-69237" },
  { label: "사업장주소", value: "내방로 442, 302호" },
  { label: "전화번호", value: "070-8028-2214" },
];

export function Footer() {
  return (
    <footer className="border-t border-[var(--border)] bg-[var(--background)] px-6 py-8 text-sm text-[var(--muted)]">
      <div className="mx-auto flex max-w-5xl flex-col gap-3">
        <span className="font-semibold text-[var(--foreground)]">클릭툰</span>
        <dl className="flex flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:gap-x-6 sm:gap-y-1">
          {BUSINESS.map((item) => (
            <div key={item.label} className="flex gap-1.5">
              <dt className="text-[var(--muted)]">{item.label}</dt>
              <dd className="text-[var(--foreground)]">{item.value}</dd>
            </div>
          ))}
        </dl>
        {/* 결제 관련 정책은 도달 경로가 없으면 게시하지 않은 것과 같다.
            PG 심사에서도 확인하는 항목이므로 푸터에 상시 노출한다. */}
        <nav className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
          <Link
            href="/policy/refund"
            className="text-[var(--muted)] underline-offset-2 transition hover:text-[var(--foreground)] hover:underline"
          >
            환불 정책
          </Link>
        </nav>
        <span className="text-xs text-[var(--muted)]">
          © {new Date().getFullYear()} 클릭툰. All rights reserved.
        </span>
      </div>
    </footer>
  );
}
