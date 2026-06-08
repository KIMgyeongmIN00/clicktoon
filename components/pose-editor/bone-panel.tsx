"use client";
import { BONE_LABEL, GROUPS, bonesByGroup } from "./bones";
import { LIMITS, axisLocked, clamp } from "./limits";
import { Button } from "@/components/ui/button";

export function BonePanel({
  selected,
  rotations,
  onSelect,
  onRotate,
  onResetBone,
  onResetAll,
}: {
  selected: string | null;
  rotations: Record<string, [number, number, number]>;
  onSelect: (name: string | null) => void;
  onRotate: (name: string, rot: [number, number, number]) => void;
  onResetBone: (name: string) => void;
  onResetAll: () => void;
}) {
  const current = selected ? rotations[selected] ?? [0, 0, 0] : null;
  const limits = selected ? LIMITS[selected] : null;
  const grouped = bonesByGroup();

  function setAxis(axis: 0 | 1 | 2, value: number) {
    if (!selected || !current || !limits) return;
    const range = [limits.x, limits.y, limits.z][axis];
    const next: [number, number, number] = [...current] as [number, number, number];
    next[axis] = clamp(value, range.min, range.max);
    onRotate(selected, next);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="space-y-2">
        {GROUPS.map((g) => (
          <div key={g}>
            <div className="mb-1 text-[10px] uppercase tracking-wide text-[var(--muted)]">
              {g}
            </div>
            <div className="flex flex-wrap gap-1">
              {(grouped[g] ?? []).map((b) => (
                <button
                  key={b.name}
                  type="button"
                  onClick={() => onSelect(b.name)}
                  className={[
                    "rounded-md border px-2 py-1 text-xs transition",
                    selected === b.name
                      ? "border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--foreground)]"
                      : "border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--foreground)]",
                  ].join(" ")}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {!selected && (
        <div className="rounded-md border border-dashed border-[var(--border)] p-3 text-xs text-[var(--muted)]">
          본을 선택하면 회전 슬라이더가 나타나고, 캔버스에는 회전 gizmo가 표시됩니다. 캔버스에서 직접 드래그하거나 슬라이더로 조작하세요. 인체 가동범위 내로 자동 제한됩니다.
        </div>
      )}

      {selected && current && limits && (
        <div className="space-y-3 rounded-md border border-[var(--border)] bg-[var(--surface)] p-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">{BONE_LABEL[selected]}</div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => onResetBone(selected)}
            >
              초기화
            </Button>
          </div>
          {(["X", "Y", "Z"] as const).map((axisLabel, i) => {
            const range = [limits.x, limits.y, limits.z][i];
            const locked = axisLocked(range);
            return (
              <AxisSlider
                key={axisLabel}
                label={axisLabel}
                value={current[i]}
                min={range.min}
                max={range.max}
                locked={locked}
                onChange={(v) => setAxis(i as 0 | 1 | 2, v)}
              />
            );
          })}
        </div>
      )}

      <Button variant="outline" type="button" onClick={onResetAll}>
        전체 포즈 초기화
      </Button>
    </div>
  );
}

function AxisSlider({
  label,
  value,
  min,
  max,
  locked,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  locked: boolean;
  onChange: (v: number) => void;
}) {
  const toDeg = (rad: number) => (rad * 180) / Math.PI;
  const deg = toDeg(value);
  const minDeg = Math.round(toDeg(min));
  const maxDeg = Math.round(toDeg(max));

  if (locked) {
    return (
      <div className="opacity-40">
        <div className="flex items-center justify-between text-xs">
          <span className="text-[var(--muted)]">{label}</span>
          <span className="text-[10px]">잠김</span>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-[var(--muted)]">{label}</span>
        <span className="tabular-nums">
          <span className="text-[var(--muted)]">{minDeg}°</span>
          <span className="mx-1.5 text-[var(--foreground)]">{deg.toFixed(0)}°</span>
          <span className="text-[var(--muted)]">{maxDeg}°</span>
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={(Math.PI * 2) / 720}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-2 w-full cursor-pointer appearance-none rounded bg-[var(--surface-2)] accent-[var(--accent)]"
      />
    </div>
  );
}
