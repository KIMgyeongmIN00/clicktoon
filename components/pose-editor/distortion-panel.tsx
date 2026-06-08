"use client";
import { useEffect, useRef, useState } from "react";
import { DistortionType, PoseState } from "@/types/pose";
import { DISTORTIONS, applyDistortion } from "@/lib/distortion";

type Distortion = PoseState["distortion"];

export function DistortionPanel({
  value,
  onChange,
  capture,
}: {
  value: Distortion;
  onChange: (next: Distortion) => void;
  // Raw (undistorted) canvas capture; used to build the live preview.
  capture: () => string;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const lastRaw = useRef<string>("");
  const busy = useRef(false);

  // Live preview that tracks BOTH the chosen effect/strength AND the current
  // canvas (pose edits, camera orbit). We poll the raw capture on an interval
  // and only re-run the GPU distortion when the captured frame actually changed.
  useEffect(() => {
    if (value.type === "none" || value.strength <= 0) {
      setPreview(null);
      lastRaw.current = "";
      return;
    }

    let cancelled = false;
    // Force a refresh when the effect/strength changes.
    lastRaw.current = "";

    async function tick() {
      if (cancelled || busy.current) return;
      const raw = capture();
      if (!raw) return;
      if (raw === lastRaw.current) return; // canvas unchanged → skip
      lastRaw.current = raw;
      busy.current = true;
      try {
        const out = await applyDistortion(raw, value.type, value.strength);
        if (!cancelled) setPreview(out);
      } catch {
        /* ignore preview errors */
      } finally {
        busy.current = false;
      }
    }

    tick();
    const iv = setInterval(tick, 150);
    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, [value.type, value.strength, capture]);

  return (
    <div className="space-y-3 rounded-md border border-[var(--border)] bg-[var(--surface)] p-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">카메라 왜곡</div>
        <div className="text-[10px] text-[var(--muted)]">캡처 시 적용</div>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        {DISTORTIONS.map((d) => {
          const active = value.type === d.id;
          return (
            <button
              key={d.id}
              type="button"
              title={d.hint}
              onClick={() =>
                onChange({ ...value, type: d.id as DistortionType })
              }
              className={[
                "rounded-md border px-2 py-1.5 text-xs transition",
                active
                  ? "border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--foreground)]"
                  : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--muted)] hover:text-[var(--foreground)]",
              ].join(" ")}
            >
              {d.label}
            </button>
          );
        })}
      </div>

      {value.type !== "none" && (
        <div>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="text-[var(--muted)]">강도</span>
            <span className="tabular-nums">
              {Math.round(value.strength * 100)}%
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.02}
            value={value.strength}
            onChange={(e) =>
              onChange({ ...value, strength: Number(e.target.value) })
            }
            className="h-2 w-full cursor-pointer appearance-none rounded bg-[var(--surface-2)] accent-[var(--accent)]"
          />
        </div>
      )}

      {value.type !== "none" && (
        <div className="overflow-hidden rounded-md border border-[var(--border)] bg-black">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview}
              alt="왜곡 미리보기"
              className="block w-full"
            />
          ) : (
            <div className="flex h-24 items-center justify-center text-[10px] text-[var(--muted)]">
              미리보기 생성 중…
            </div>
          )}
        </div>
      )}
      <p className="text-[10px] leading-relaxed text-[var(--muted)]">
        선택한 왜곡은 이미지 생성·캔버스 캡처 결과물에 그대로 적용됩니다. 편집
        화면(좌측)에는 적용되지 않아 조작이 편합니다.
      </p>
    </div>
  );
}
