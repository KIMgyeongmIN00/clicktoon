"use client";
import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

export function AccordionSection({
  icon,
  title,
  badge,
  defaultOpen = false,
  children,
}: {
  icon: ReactNode;
  title: string;
  badge?: string | null;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 rounded-lg px-3.5 py-3 text-left transition hover:bg-[var(--surface-2)]"
      >
        <span className="shrink-0 text-[var(--accent)]">{icon}</span>
        <span className="text-sm font-medium text-[var(--foreground)]">
          {title}
        </span>
        {badge ? (
          <span className="max-w-[40%] truncate rounded-full bg-[var(--accent)]/15 px-2 py-0.5 text-[10px] text-[var(--accent)]">
            {badge}
          </span>
        ) : null}
        <ChevronDown
          size={16}
          className={[
            "ml-auto shrink-0 text-[var(--muted)] transition-transform",
            open ? "rotate-180" : "",
          ].join(" ")}
        />
      </button>
      {open ? (
        <div className="space-y-4 border-t border-[var(--border)] px-3.5 pb-4 pt-3">
          {children}
        </div>
      ) : null}
    </div>
  );
}
