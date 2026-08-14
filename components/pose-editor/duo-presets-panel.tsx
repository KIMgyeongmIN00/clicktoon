"use client";
import { useMemo } from "react";
import { DUO_GROUPS, duoPresetsByGroup } from "./duo-presets";

// 2인 장면 프리셋. 뼈뿐 아니라 두 피규어의 배치와 방향까지 한 번에 잡는다.
export function DuoPresetsPanel({
  figureCount,
  onApply,
}: {
  figureCount: number;
  onApply: (id: string) => void;
}) {
  const grouped = useMemo(() => duoPresetsByGroup(), []);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-wide text-[var(--muted)]">
          2인 구도 프리셋
        </div>
        {figureCount > 2 && (
          <span className="text-[9px] text-[var(--muted)]">
            앞의 두 피규어에 적용
          </span>
        )}
      </div>

      {figureCount < 2 && (
        <div className="rounded-md border border-dashed border-[var(--border)] p-2.5 text-[11px] text-[var(--muted)]">
          누르면 상대역 피규어가 자동으로 추가됩니다. 추가된 피규어에 캐릭터를
          배정해주세요.
        </div>
      )}

      {DUO_GROUPS.map((g) => (
        <div key={g}>
          <div className="mb-1 text-[10px] font-medium text-[var(--muted)]">
            {g}
          </div>
          <div className="space-y-1">
            {grouped[g].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onApply(p.id)}
                title={p.hint}
                className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-left transition hover:border-[var(--accent)]"
              >
                <span className="block text-xs text-[var(--foreground)]">
                  {p.label}
                </span>
                <span className="block text-[10px] text-[var(--muted)]">
                  {p.hint}
                </span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
