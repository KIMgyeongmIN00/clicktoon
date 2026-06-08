"use client";
import { PenLine, Palette } from "lucide-react";
import { RenderMode } from "@/types/pose";

const OPTIONS: {
  id: RenderMode;
  label: string;
  hint: string;
  Icon: typeof PenLine;
}[] = [
  {
    id: "sketch",
    label: "스케치",
    hint: "선만 — 채색·명암 없음",
    Icon: PenLine,
  },
  {
    id: "color",
    label: "채색",
    hint: "내부 채색 + 명암 전부",
    Icon: Palette,
  },
];

export function RenderModeSelector({
  value,
  onChange,
}: {
  value: RenderMode;
  onChange: (next: RenderMode) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="text-[10px] uppercase tracking-wide text-[var(--muted)]">
        출력 모드
      </div>
      <div className="grid grid-cols-2 gap-2">
        {OPTIONS.map((o) => {
          const active = value === o.id;
          const Icon = o.Icon;
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => onChange(o.id)}
              className={[
                "flex flex-col items-start gap-1 rounded-md border px-3 py-2 text-left transition",
                active
                  ? "border-[var(--accent)] bg-[var(--accent)]/15"
                  : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--accent)]/60",
              ].join(" ")}
            >
              <span className="flex items-center gap-1.5 text-sm font-medium">
                <Icon size={14} />
                {o.label}
              </span>
              <span className="text-[10px] text-[var(--muted)]">{o.hint}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
