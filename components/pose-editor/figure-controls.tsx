"use client";
import { Bone, Move, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Figure,
  FIGURE_SCALE_MAX,
  FIGURE_SCALE_MIN,
  FIGURE_Y_MAX,
  FIGURE_Y_MIN,
} from "@/types/pose";

/**
 * 캔버스 조작 모드. 기즈모는 항상 하나만 뜨므로 셋 중 하나로 배타 선택한다.
 * - bone: 관절 마커가 켜지고, 고른 관절에 회전 기즈모가 붙는다.
 * - translate / rotate: 피규어 전체를 바닥면에서 옮기거나 좌우로 돌린다.
 */
export type EditMode = "bone" | "translate" | "rotate";

const MODES: { id: EditMode; label: string; hint: string; Icon: typeof Bone }[] =
  [
    { id: "bone", label: "관절", hint: "포즈 잡기", Icon: Bone },
    { id: "translate", label: "이동", hint: "바닥에서 옮기기", Icon: Move },
    { id: "rotate", label: "회전", hint: "좌우로 돌리기", Icon: RotateCw },
  ];

export function FigureControls({
  figure,
  mode,
  onModeChange,
  onScaleChange,
  onHeightChange,
  onResetPlacement,
}: {
  figure: Figure | null;
  mode: EditMode;
  onModeChange: (next: EditMode) => void;
  onScaleChange: (next: number) => void;
  onHeightChange: (next: number) => void;
  onResetPlacement: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <div className="text-[10px] uppercase tracking-wide text-[var(--muted)]">
          조작 모드
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {MODES.map((m) => {
            const active = mode === m.id;
            const Icon = m.Icon;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => onModeChange(m.id)}
                className={[
                  "flex flex-col items-center gap-0.5 rounded-md border px-2 py-2 transition",
                  active
                    ? "border-[var(--accent)] bg-[var(--accent)]/15"
                    : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--accent)]/60",
                ].join(" ")}
              >
                <Icon size={14} />
                <span className="text-[11px] font-medium">{m.label}</span>
                <span className="text-[9px] text-[var(--muted)]">{m.hint}</span>
              </button>
            );
          })}
        </div>
      </div>

      {!figure ? (
        <div className="rounded-md border border-dashed border-[var(--border)] p-3 text-xs text-[var(--muted)]">
          왼쪽 목록이나 캔버스에서 피규어를 고르면 조작할 수 있어요.
        </div>
      ) : (
        <div className="space-y-3 rounded-md border border-[var(--border)] bg-[var(--surface)] p-3">
          <div>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="text-[var(--muted)]">크기</span>
              <span className="tabular-nums text-[var(--foreground)]">
                {figure.scale.toFixed(2)}×
              </span>
            </div>
            {/* 균등 배율만 — 기즈모의 스케일 모드는 비균등 스케일로 리그를
                망가뜨리기 쉬워 슬라이더로 뺐다. 어른/아이 같은 키 차이용. */}
            <input
              type="range"
              min={FIGURE_SCALE_MIN}
              max={FIGURE_SCALE_MAX}
              step={0.01}
              value={figure.scale}
              onChange={(e) => onScaleChange(Number(e.target.value))}
              className="h-2 w-full cursor-pointer appearance-none rounded bg-[var(--surface-2)] accent-[var(--accent)]"
            />
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="text-[var(--muted)]">높이</span>
              <span className="tabular-nums text-[var(--foreground)]">
                {figure.position[1] === 0
                  ? "지면"
                  : figure.position[1].toFixed(2)}
              </span>
            </div>
            {/* 이 리그는 골반 높이가 고정이라 다리를 접어도 몸이 내려오지
                않는다. 앉기 프리셋은 접지 높이를 갖고 있지만, 관절을 직접
                고친 뒤에는 여기서 맞춰야 한다. 이동 기즈모는 XZ 전용. */}
            <input
              type="range"
              min={FIGURE_Y_MIN}
              max={FIGURE_Y_MAX}
              step={0.01}
              value={figure.position[1]}
              onChange={(e) => onHeightChange(Number(e.target.value))}
              className="h-2 w-full cursor-pointer appearance-none rounded bg-[var(--surface-2)] accent-[var(--accent)]"
            />
          </div>

          <div className="flex items-center justify-between text-[10px] text-[var(--muted)]">
            <span className="tabular-nums">
              위치 {figure.position[0].toFixed(2)}, {figure.position[2].toFixed(2)}
            </span>
            <span className="tabular-nums">
              방향 {Math.round((figure.rotationY * 180) / Math.PI)}°
            </span>
          </div>

          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={onResetPlacement}
            className="w-full"
          >
            배치 초기화
          </Button>
        </div>
      )}
    </div>
  );
}
