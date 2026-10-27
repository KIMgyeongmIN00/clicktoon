"use client";

import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { AccordionSection } from "./accordion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { adaptDebugPose, debugPoseContext, DEBUG_POSE_EXAMPLE, exportDebugPose } from "@/lib/pose/debug-adapter";
import type { Figure, PoseState } from "@/types/pose";

export function PoseDebugPanel({ pose, onApply, disabled }: {
  pose: PoseState;
  onApply: (figures: Figure[]) => void;
  disabled: boolean;
}) {
  const [text, setText] = useState(() => JSON.stringify(exportDebugPose(pose), null, 2));
  const [previous, setPrevious] = useState<Figure[] | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  function apply() {
    try {
      const result = adaptDebugPose(text, pose);
      setPrevious(structuredClone(pose.figures));
      onApply(result.pose.figures);
      setError("");
      setMessage([
        `${result.pose.figures.length}명 적용 완료${result.draft.interaction ? ` · 관계: ${result.draft.interaction.relation}` : ""}`,
        ...result.warnings,
      ].join("\n"));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "입력을 확인해 주세요.");
      setMessage("");
    }
  }

  async function copyContext() {
    try {
      await navigator.clipboard.writeText(debugPoseContext());
      setMessage("AI 컨텍스트를 복사했습니다. AI에 붙여 넣고 마지막 줄에 원하는 자세를 적으세요.");
      setError("");
    } catch {
      setError("클립보드 복사에 실패했습니다. 아래 컨텍스트를 펼쳐 직접 복사하세요.");
    }
  }

  if (process.env.NODE_ENV !== "development") return null;

  return (
    <AccordionSection icon={<SlidersHorizontal size={16} />} title="포즈 JSON 테스트" badge="개발용" defaultOpen>
      <p className="text-xs text-[var(--muted)]">
        AI 컨텍스트 복사 → AI에 자세 요청 → 결과 JSON 입력 → 적용.
        회전은 도 단위이며, 누락 관절은 T 포즈로 초기화됩니다.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" onClick={copyContext}>AI 컨텍스트 복사</Button>
        <Button type="button" size="sm" variant="outline" onClick={() => { setText(JSON.stringify(exportDebugPose(pose), null, 2)); setError(""); setMessage(""); }}>현재 포즈 읽기</Button>
        <Button type="button" size="sm" variant="outline" onClick={() => { setText(JSON.stringify(DEBUG_POSE_EXAMPLE, null, 2)); setError(""); setMessage(""); }}>2인 예시</Button>
      </div>
      <label htmlFor="pose-debug-json" className="block text-xs font-medium">포즈 데이터 JSON (degree)</label>
      <Textarea id="pose-debug-json" value={text} onChange={(event) => { setText(event.target.value); setError(""); setMessage(""); }} spellCheck={false} className="min-h-64 font-mono text-xs" aria-invalid={!!error} aria-describedby="pose-debug-feedback" />
      <p className="text-xs text-[var(--muted)]">
        인물 수와 자세를 입력값으로 교체합니다. 캐릭터는 기존 배열 순서로 유지됩니다.
        적용 결과는 기존 자동 저장에 포함됩니다. 접촉은 자동 보정되지 않습니다.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={apply} disabled={disabled || !text.trim()}>포즈 적용</Button>
        <Button type="button" size="sm" variant="outline" disabled={disabled || !previous} onClick={() => {
          if (!previous) return;
          onApply(previous);
          setPrevious(null);
          setError("");
          setMessage("마지막 적용 직전의 인물과 자세로 되돌렸습니다.");
        }}>적용 전으로 되돌리기</Button>
      </div>
      <div id="pose-debug-feedback" className="whitespace-pre-wrap break-words text-xs">
        {error ? <p role="alert" className="text-[var(--danger)]">{error}</p> : <p role="status">{message}</p>}
      </div>
      <details className="text-xs text-[var(--muted)]">
        <summary className="cursor-pointer">AI 컨텍스트 직접 복사</summary>
        <Textarea aria-label="AI 컨텍스트" readOnly value={debugPoseContext()} className="mt-2 h-40 font-mono text-xs" />
      </details>
    </AccordionSection>
  );
}
