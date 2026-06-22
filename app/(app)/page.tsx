"use client";
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Camera, Frame, Palette, RefreshCw, SlidersHorizontal, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AccordionSection } from "@/components/pose-editor/accordion";
import { BonePanel } from "@/components/pose-editor/bone-panel";
import { LightPad2D } from "@/components/pose-editor/light-pad";
import { CanvasSizeSelector } from "@/components/pose-editor/canvas-size";
import { CharacterPicker } from "@/components/pose-editor/character-picker";
import { ProviderPicker } from "@/components/pose-editor/provider-picker";
import { DistortionPanel } from "@/components/pose-editor/distortion-panel";
import { RenderModeSelector } from "@/components/pose-editor/render-mode";
import { PosePresets } from "@/components/pose-editor/pose-presets";
import { PRESETS, applyPreset } from "@/components/pose-editor/presets";
import { CONTROL_BONES } from "@/components/pose-editor/bones";
import { clampRotation } from "@/components/pose-editor/limits";
import { generationCost } from "@/lib/credits/cost";
import {
  CANVAS_SIZES,
  CanvasAspect,
  DEFAULT_POSE,
  PoseState,
} from "@/types/pose";
import { CharacterWithUrls } from "@/types/character";
import { Provider } from "@/lib/providers/types";
import { applyDistortion } from "@/lib/distortion";
import { loadPose, savePose } from "@/lib/pose/storage";

const PoseScene = dynamic(
  () => import("@/components/pose-editor/scene").then((m) => m.PoseScene),
  { ssr: false },
);

// useSearchParams needs a Suspense boundary in Next 16.
export default function HomePage() {
  return (
    <Suspense fallback={null}>
      <PoseGenerator />
    </Suspense>
  );
}

function PoseGenerator() {
  const searchParams = useSearchParams();
  const initialCharId = searchParams.get("character");

  const [characters, setCharacters] = useState<CharacterWithUrls[] | null>(
    null,
  );
  const [selectedId, setSelectedId] = useState<string | null>(initialCharId);
  const [pose, setPose] = useState<PoseState>(DEFAULT_POSE);
  const [selectedBone, setSelectedBone] = useState<string | null>(null);
  const [provider, setProvider] = useState<Provider>("google");
  const [extraPrompt, setExtraPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [genStatus, setGenStatus] = useState<"queued" | "processing" | null>(
    null,
  );
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [genError, setGenError] = useState<string | null>(null);
  const captureRef = useRef<() => string>(() => "");

  // Load characters
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/characters");
        const json = await r.json();
        if (!r.ok) throw new Error(json.error ?? "load failed");
        const items: CharacterWithUrls[] = json.items;
        setCharacters(items);
        setSelectedId((cur) => cur ?? items[0]?.id ?? null);
      } catch (e) {
        toast.error(`캐릭터 불러오기 실패: ${(e as Error).message}`);
        setCharacters([]);
      }
    })();
  }, []);

  // Load pose for the selected character (falls back to last global pose)
  useEffect(() => {
    setPose(loadPose(selectedId ?? undefined));
  }, [selectedId]);

  useEffect(() => {
    const t = setTimeout(() => savePose(pose, selectedId ?? undefined), 300);
    return () => clearTimeout(t);
  }, [pose, selectedId]);

  // Slider path: apply per-axis human range-of-motion limits.
  const setRotation = useCallback(
    (name: string, rot: [number, number, number]) => {
      const clamped = clampRotation(name, rot);
      setPose((p) => ({ ...p, bones: { ...p.bones, [name]: clamped } }));
    },
    [],
  );

  // Gizmo path: store free 3D rotation as-is (clamping here causes the rotation
  // to snap onto the wrong axis at gimbal lock).
  const setRotationFree = useCallback(
    (name: string, rot: [number, number, number]) => {
      setPose((p) => ({ ...p, bones: { ...p.bones, [name]: rot } }));
    },
    [],
  );

  const applyPresetById = useCallback((presetId: string) => {
    const preset = PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setPose((p) => ({ ...p, bones: applyPreset(p.bones, preset) }));
  }, []);

  // Apply a saved pose's bones (clamped) as a complete replacement.
  const applyBones = useCallback(
    (bones: Record<string, [number, number, number]>) => {
      const next: Record<string, [number, number, number]> = {};
      for (const [name, rot] of Object.entries(bones)) {
        next[name] = clampRotation(name, rot);
      }
      setPose((p) => ({ ...p, bones: next }));
    },
    [],
  );

  const resetBone = useCallback((name: string) => {
    setPose((p) => {
      const next = { ...p.bones };
      delete next[name];
      return { ...p, bones: next };
    });
  }, []);

  const resetAll = useCallback(() => {
    setPose((p) => ({
      ...DEFAULT_POSE,
      light2d: p.light2d,
      aspect: p.aspect,
      distortion: p.distortion,
    }));
  }, []);

  const registerCapture = useCallback((fn: () => string) => {
    captureRef.current = fn;
  }, []);

  const rawCapture = useCallback(() => captureRef.current?.() ?? "", []);

  const memoizedSelectBone = useMemo(() => setSelectedBone, []);

  const selectedCharacter = useMemo(
    () => characters?.find((c) => c.id === selectedId) ?? null,
    [characters, selectedId],
  );

  // Human-readable name of the currently selected joint, for the 세부 조정 badge.
  const selectedBoneLabel = useMemo(() => {
    if (!selectedBone) return null;
    const b = CONTROL_BONES.find((x) => x.name === selectedBone);
    return b ? `${b.group} ${b.label}` : selectedBone;
  }, [selectedBone]);

  const aspect = pose.aspect;
  const dims = CANVAS_SIZES[aspect];
  const arNum = dims.w / dims.h;

  // Capture raw canvas → apply lens distortion → final dataURL.
  async function captureFinal(): Promise<string> {
    const raw = captureRef.current?.();
    if (!raw) throw new Error("캔버스 캡처 실패");
    return applyDistortion(raw, pose.distortion.type, pose.distortion.strength);
  }

  // 생성은 비동기 — enqueue 후 row 상태를 폴링한다(done/failed까지). (SDD §4-D3)
  async function pollGeneration(generationId: string): Promise<void> {
    const maxAttempts = 150; // ~5분 (2s 간격)
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((res) => setTimeout(res, 2000));
      const r = await fetch(`/api/generations/${generationId}`);
      const json = await r.json();
      if (!r.ok) throw new Error(json.error ?? "상태 조회 실패");
      const status = json.generation?.status;
      if (status === "processing") setGenStatus("processing");
      if (status === "done") {
        setResultUrl(json.result_url);
        toast.success("생성 완료");
        return;
      }
      if (status === "failed") {
        throw new Error(json.generation?.error_message ?? "생성에 실패했습니다");
      }
    }
    throw new Error("시간 초과 — 잠시 후 갤러리에서 확인해주세요");
  }

  async function generate() {
    if (busy) return;
    if (!selectedCharacter) {
      toast.error("먼저 캐릭터를 선택하세요");
      return;
    }
    setBusy(true);
    setResultUrl(null);
    setGenError(null);
    setGenStatus("queued");
    try {
      const dataUrl = await captureFinal();
      const r = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          characterId: selectedCharacter.id,
          provider,
          poseRenderDataUrl: dataUrl,
          pose,
          extraPrompt,
        }),
      });
      const json = await r.json();
      if (!r.ok) {
        if (json.code === "INSUFFICIENT_CREDITS") {
          toast.error("크레딧이 부족합니다", {
            description: "충전 후 다시 시도해주세요.",
            action: { label: "충전", onClick: () => location.assign("/charge") },
            duration: 8000,
          });
        } else {
          toast.error(json.error ?? "생성 요청 실패", { duration: 8000 });
        }
        return;
      }
      await pollGeneration(json.generationId);
    } catch (e) {
      const msg = (e as Error).message;
      setGenError(msg);
      toast.error(`생성 실패: ${msg}`, { duration: 8000 });
    } finally {
      setBusy(false);
      setGenStatus(null);
    }
  }

  async function downloadCapture() {
    try {
      const url = await captureFinal();
      const a = document.createElement("a");
      a.href = url;
      a.download = "pose-preview.png";
      a.click();
    } catch (e) {
      toast.error(`캡처 실패: ${(e as Error).message}`);
    }
  }

  return (
    <main className="grid grid-cols-1 lg:h-[calc(100dvh-57px)] lg:grid-cols-[260px_1fr_380px] lg:grid-rows-[minmax(0,1fr)]">
      {/* Left panel — character sector */}
      <aside className="flex h-full flex-col gap-4 overflow-y-auto border-r border-[var(--border)] bg-[var(--background)] p-4">
        <div>
          <div className="mb-2 text-xs font-semibold text-[var(--foreground)]">
            캐릭터
          </div>
          <CharacterPicker
            characters={characters ?? []}
            selectedId={selectedId}
            onSelect={setSelectedId}
            loading={characters === null}
          />
        </div>
      </aside>

      {/* Canvas area */}
      <div
        className="relative flex min-h-[50vh] items-center justify-center overflow-hidden bg-[var(--background)] p-4"
        style={{ containerType: "size" }}
      >
        <div
          className="relative overflow-hidden rounded-lg border border-[var(--border)] bg-black"
          style={{
            // Contain-fit the chosen aspect ratio inside the canvas area:
            // whichever of width/height is the binding constraint wins, so the
            // box always shows the true ratio (16:9 becomes wide & short, 9:16
            // becomes tall & narrow) without overflowing.
            width: `min(100cqw, calc(100cqh * ${arNum}))`,
            height: `min(100cqh, calc(100cqw / ${arNum}))`,
          }}
        >
          <PoseScene
            pose={pose}
            selected={selectedBone}
            onSelect={memoizedSelectBone}
            onRotate={setRotationFree}
            registerCapture={registerCapture}
          />
          <div className="pointer-events-none absolute left-3 top-3 rounded-md bg-[var(--surface)]/80 px-2.5 py-1 text-xs backdrop-blur">
            {selectedCharacter ? selectedCharacter.name : "캐릭터 미선택"} ·{" "}
            {aspect} · {pose.renderMode === "sketch" ? "스케치" : "채색"}
            {pose.distortion.type !== "none" && " · 왜곡"}
          </div>
        </div>
      </div>

      {/* Sidebar */}
      <aside className="flex h-full flex-col border-l border-[var(--border)] bg-[var(--background)]">
        {/* Accordion sections (independent open/close) */}
        <div className="flex-1 space-y-2.5 overflow-y-auto p-3">
          <AccordionSection icon={<Frame size={16} />} title="캔버스">
            <CanvasSizeSelector
              value={aspect}
              onChange={(a: CanvasAspect) =>
                setPose((p) => ({ ...p, aspect: a }))
              }
            />
          </AccordionSection>

          <AccordionSection icon={<Camera size={16} />} title="카메라">
            <LightPad2D
              light={pose.light2d}
              onChange={(l) => setPose((p) => ({ ...p, light2d: l }))}
              disabled={pose.renderMode === "sketch"}
              disabledNote="스케치 모드에서는 광원이 결과물에 적용되지 않습니다. (출력 스타일에서 채색 모드로 전환)"
            />
            <DistortionPanel
              value={pose.distortion}
              onChange={(d) => setPose((p) => ({ ...p, distortion: d }))}
              capture={rawCapture}
            />
          </AccordionSection>

          <AccordionSection
            icon={<SlidersHorizontal size={16} />}
            title="세부 조정"
            badge={selectedBoneLabel}
            defaultOpen
          >
            <PosePresets
              currentBones={pose.bones}
              onApplyPreset={applyPresetById}
              onApplyBones={applyBones}
            />
            <BonePanel
              selected={selectedBone}
              rotations={pose.bones}
              onSelect={setSelectedBone}
              onRotate={setRotation}
              onResetBone={resetBone}
              onResetAll={resetAll}
            />
          </AccordionSection>

          <AccordionSection
            icon={<Palette size={16} />}
            title="출력 스타일"
            forceOpen={busy || !!resultUrl || !!genError}
          >
            <RenderModeSelector
              value={pose.renderMode}
              onChange={(m) => setPose((p) => ({ ...p, renderMode: m }))}
            />
            <div className="space-y-2">
              <div className="text-[10px] uppercase tracking-wide text-[var(--muted)]">
                모델
              </div>
              <ProviderPicker value={provider} onChange={setProvider} />
            </div>
            <div>
              <div className="mb-1.5 text-[10px] uppercase tracking-wide text-[var(--muted)]">
                추가 지시 (선택)
              </div>
              <Textarea
                rows={3}
                value={extraPrompt}
                onChange={(e) => setExtraPrompt(e.target.value)}
                placeholder="예: 역동적인 카메라 앵글"
              />
            </div>
            {/* 생성 결과 영역: 진행 중 → 실패 → 완료 */}
            {busy && !resultUrl && (
              <div className="flex flex-col items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] py-8 text-xs text-[var(--muted)]">
                <RefreshCw size={20} className="animate-spin" />
                {genStatus === "queued" ? "대기 중…" : "생성 중…"}
              </div>
            )}
            {!busy && genError && (
              <div className="space-y-2 rounded-md border border-[var(--danger)]/40 bg-[var(--danger)]/10 p-3">
                <div className="text-xs font-medium text-[var(--danger)]">
                  생성 실패
                </div>
                <p className="break-keep text-[11px] text-[var(--muted)]">
                  {genError}
                </p>
                <Button
                  variant="outline"
                  type="button"
                  onClick={generate}
                  className="w-full"
                >
                  <RefreshCw /> 다시 시도
                </Button>
              </div>
            )}
            {resultUrl && (
              <div className="overflow-hidden rounded-md border border-[var(--border)] bg-[var(--surface)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={resultUrl} alt="result" className="block w-full" />
                <Link
                  href={
                    selectedCharacter
                      ? `/characters/${selectedCharacter.id}`
                      : "/gallery"
                  }
                  className="block px-3 py-2 text-center text-xs text-[var(--muted)] hover:text-[var(--foreground)]"
                >
                  갤러리에서 보기 →
                </Link>
              </div>
            )}
          </AccordionSection>
        </div>

        {/* Persistent action footer */}
        <div className="shrink-0 space-y-2 border-t border-[var(--border)] p-4">
          <p className="text-center text-[10px] text-[var(--muted)]">
            예상 소요 약{" "}
            <span className="font-medium text-[var(--foreground)]">
              {generationCost(provider).credits} 크레딧
            </span>{" "}
            (₩{generationCost(provider).krw})
          </p>
          <Button onClick={generate} disabled={busy} className="w-full">
            {busy ? <RefreshCw className="animate-spin" /> : <Wand2 />}
            {busy
              ? genStatus === "queued"
                ? "대기 중…"
                : "생성 중…"
              : "이미지 생성"}
          </Button>
          <Button
            variant="outline"
            type="button"
            onClick={downloadCapture}
            className="w-full"
          >
            <Camera /> 캔버스 캡처
          </Button>
        </div>
      </aside>
    </main>
  );
}
