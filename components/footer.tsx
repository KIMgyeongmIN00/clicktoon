const BUSINESS = [
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
        <span className="text-xs text-[var(--muted)]">
          © {new Date().getFullYear()} 클릭툰. All rights reserved.
        </span>
      </div>
    </footer>
  );
}
