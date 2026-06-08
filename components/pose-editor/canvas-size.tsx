"use client";
import { CANVAS_SIZES, CanvasAspect } from "@/types/pose";

export function CanvasSizeSelector({
  value,
  onChange,
}: {
  value: CanvasAspect;
  onChange: (next: CanvasAspect) => void;
}) {
  const entries = Object.entries(CANVAS_SIZES) as [
    CanvasAspect,
    (typeof CANVAS_SIZES)[CanvasAspect],
  ][];

  return (
    <div className="space-y-2">
      <div className="text-[10px] uppercase tracking-wide text-[var(--muted)]">
        캔버스 크기 (출력 비율)
      </div>
      <div className="grid grid-cols-5 gap-1.5">
        {entries.map(([aspect, dim]) => {
          const active = value === aspect;
          // mini aspect preview box
          const isPortrait = dim.h >= dim.w;
          const boxW = isPortrait ? (dim.w / dim.h) * 26 : 26;
          const boxH = isPortrait ? 26 : (dim.h / dim.w) * 26;
          return (
            <button
              key={aspect}
              type="button"
              onClick={() => onChange(aspect)}
              title={`${dim.label} · ${dim.w}×${dim.h}`}
              className={[
                "flex flex-col items-center gap-1 rounded-md border px-1 py-2 transition",
                active
                  ? "border-[var(--accent)] bg-[var(--accent)]/15"
                  : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--accent)]/60",
              ].join(" ")}
            >
              <span className="flex h-7 w-7 items-center justify-center">
                <span
                  className={
                    active
                      ? "bg-[var(--accent)]"
                      : "bg-[var(--muted)]"
                  }
                  style={{ width: boxW, height: boxH, borderRadius: 2 }}
                />
              </span>
              <span className="text-[10px] tabular-nums">{aspect}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
