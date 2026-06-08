"use client";
import { useRef } from "react";
import { PoseState } from "@/types/pose";

type Light2D = PoseState["light2d"];

export function LightPad2D({
  light,
  onChange,
  disabled = false,
  disabledNote,
}: {
  light: Light2D;
  onChange: (next: Light2D) => void;
  disabled?: boolean;
  disabledNote?: string;
}) {
  const padRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  function setFromEvent(clientX: number, clientY: number) {
    if (disabled) return;
    const el = padRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const nx = (clientX - rect.left) / rect.width; // 0..1 left→right
    const ny = (clientY - rect.top) / rect.height; // 0..1 top→bottom
    const x = Math.max(-1, Math.min(1, nx * 2 - 1));
    const y = Math.max(-1, Math.min(1, -(ny * 2 - 1))); // invert: top = +1
    onChange({ ...light, x: round2(x), y: round2(y) });
  }

  // Dot position in % of the pad
  const dotLeft = ((light.x + 1) / 2) * 100;
  const dotTop = ((1 - light.y) / 2) * 100;

  return (
    <div
      className={[
        "space-y-3 rounded-md border border-[var(--border)] bg-[var(--surface)] p-3",
        disabled ? "opacity-50" : "",
      ].join(" ")}
    >
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">광원 (2D)</div>
        <div className="text-[10px] text-[var(--muted)]">
          캔버스 기준 위치
        </div>
      </div>

      {disabled && disabledNote && (
        <div className="rounded-md border border-dashed border-[var(--border)] px-2 py-1.5 text-[10px] text-[var(--muted)]">
          {disabledNote}
        </div>
      )}

      <div
        ref={padRef}
        onPointerDown={(e) => {
          dragging.current = true;
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          setFromEvent(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => {
          if (dragging.current) setFromEvent(e.clientX, e.clientY);
        }}
        onPointerUp={() => (dragging.current = false)}
        className={[
          "relative aspect-square w-full overflow-hidden rounded-md border border-[var(--border)]",
          disabled ? "cursor-not-allowed" : "cursor-crosshair",
        ].join(" ")}
        style={{
          background:
            "radial-gradient(circle at center, #2a2a35 0%, #14141a 80%)",
        }}
      >
        {/* center crosshair */}
        <div className="pointer-events-none absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-[var(--border)]/50" />
        <div className="pointer-events-none absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-[var(--border)]/50" />
        {/* light glow */}
        <div
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            left: `${dotLeft}%`,
            top: `${dotTop}%`,
            width: 64,
            height: 64,
            background: `radial-gradient(circle, ${light.color}cc 0%, transparent 70%)`,
            opacity: Math.min(1, 0.3 + light.intensity / 6),
          }}
        />
        {/* dot */}
        <div
          className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
          style={{
            left: `${dotLeft}%`,
            top: `${dotTop}%`,
            background: light.color,
          }}
        />
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className="text-[var(--muted)]">강도</span>
          <span className="tabular-nums">{light.intensity.toFixed(2)}</span>
        </div>
        <input
          type="range"
          min={0}
          max={6}
          step={0.05}
          disabled={disabled}
          value={light.intensity}
          onChange={(e) =>
            onChange({ ...light, intensity: Number(e.target.value) })
          }
          className="h-2 w-full cursor-pointer appearance-none rounded bg-[var(--surface-2)] accent-[var(--accent)] disabled:cursor-not-allowed"
        />
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs text-[var(--muted)]">색상</span>
        <input
          type="color"
          value={light.color}
          disabled={disabled}
          onChange={(e) => onChange({ ...light, color: e.target.value })}
          className="h-7 w-10 cursor-pointer rounded border border-[var(--border)] bg-transparent disabled:cursor-not-allowed"
        />
        <span className="text-xs text-[var(--muted)]">{light.color}</span>
      </div>
    </div>
  );
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
