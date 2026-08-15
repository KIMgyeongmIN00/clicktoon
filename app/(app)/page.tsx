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
import { useRouter, useSearchParams } from "next/navigation";
import { nanoid } from "nanoid";
import { toast } from "sonner";
import { Camera, Frame, Palette, RefreshCw, SlidersHorizontal, Users, Wand2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AccordionSection } from "@/components/pose-editor/accordion";
import { BonePanel } from "@/components/pose-editor/bone-panel";
import { LightPad2D } from "@/components/pose-editor/light-pad";
import { CanvasSizeSelector } from "@/components/pose-editor/canvas-size";
import { SceneFigures } from "@/components/pose-editor/scene-figures";
import {
  FigureControls,
  type EditMode,
} from "@/components/pose-editor/figure-controls";
import { ProviderPicker } from "@/components/pose-editor/provider-picker";
import { DistortionPanel } from "@/components/pose-editor/distortion-panel";
import { RenderModeSelector } from "@/components/pose-editor/render-mode";
import { PosePresets } from "@/components/pose-editor/pose-presets";
import { DuoPresetsPanel } from "@/components/pose-editor/duo-presets-panel";
import { PRESETS, applyPreset } from "@/components/pose-editor/presets";
import {
  DUO_PRESETS,
  placementToFigurePatch,
} from "@/components/pose-editor/duo-presets";
import { CONTROL_BONES } from "@/components/pose-editor/bones";
import { clampRotation } from "@/components/pose-editor/limits";
import type { CaptureResult } from "@/components/pose-editor/scene";
import { browserSupabase } from "@/lib/supabase/browser";
import {
  listLocalCharacters,
  type LocalCharacter,
} from "@/lib/local/characters";
import {
  remapFigureCharacters,
  savePendingGeneration,
  takePendingGeneration,
} from "@/lib/local/pending";
import { syncLocalCharactersToServer } from "@/lib/local/sync";
import { isDemoUi } from "@/lib/demo-client";
import {
  CANVAS_SIZES,
  CanvasAspect,
  DEFAULT_POSE,
  Figure,
  FIGURE_SPACING,
  MAX_FIGURES,
  PoseState,
  Selection,
} from "@/types/pose";
import { CharacterWithUrls } from "@/types/character";
import { Provider } from "@/lib/providers/types";
import { applyDistortion } from "@/lib/distortion";
import { loadPose, savePose } from "@/lib/pose/storage";

const PoseScene = dynamic(
  () => import("@/components/pose-editor/scene").then((m) => m.PoseScene),
  { ssr: false },
);

const EMPTY_CAPTURE: CaptureResult = { dataUrl: "", layout: [] };

// useSearchParams needs a Suspense boundary in Next 16.
export default function HomePage() {
  return (
    <Suspense fallback={null}>
      <PoseGenerator />
    </Suspense>
  );
}

// 로컬(IndexedDB) 캐릭터를 피커가 소비하는 shape로 어댑트.
function localToCharacter(c: LocalCharacter): CharacterWithUrls {
  const prim = c.images.front ?? c.images.side ?? c.images.back;
  const url = prim ? URL.createObjectURL(prim) : "";
  return {
    id: c.id,
    owner: null,
    name: c.name,
    ref_path: "",
    thumb_path: null,
    meta: c.meta,
    created_at: new Date(c.createdAt).toISOString(),
    updated_at: new Date(c.createdAt).toISOString(),
    ref_url: url,
    thumb_url: url,
  };
}

function PoseGenerator() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialCharId = searchParams.get("character");

  const [characters, setCharacters] = useState<CharacterWithUrls[] | null>(
    null,
  );
  const [pose, setPose] = useState<PoseState>(DEFAULT_POSE);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [editMode, setEditMode] = useState<EditMode>("bone");
  const [provider, setProvider] = useState<Provider>("google");
  const [extraPrompt, setExtraPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [genStatus, setGenStatus] = useState<"queued" | "processing" | null>(
    null,
  );
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [genError, setGenError] = useState<string | null>(null);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [quotaLeft, setQuotaLeft] = useState<number | null>(null);
  const [quotaUnlimited, setQuotaUnlimited] = useState(false);
  const [resumeArmed, setResumeArmed] = useState(false);
  const [demo, setDemo] = useState(false);
  const captureRef = useRef<() => CaptureResult>(() => EMPTY_CAPTURE);
  const bootRef = useRef(false);

  // 시연 모드 배지 상태(쿠키) + 어드민 토글 리다이렉트(?demo=on/off) 피드백.
  useEffect(() => {
    setDemo(isDemoUi());
    const flag = searchParams.get("demo");
    if (flag === "on") toast.success("🎬 시연 모드 ON — 이 브라우저만 무제한·지정 이미지");
    else if (flag === "off") toast.info("시연 모드 OFF — 실제 파이프라인으로 복귀");
    if (flag) router.replace("/");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refreshQuota() {
    try {
      const r = await fetch("/api/quota");
      if (!r.ok) return;
      const q = await r.json();
      setQuotaUnlimited(!!q.unlimited);
      setQuotaLeft(q.pose?.left ?? null);
    } catch {
      /* ignore */
    }
  }

  // 장면 복원 — 마운트 시 1회. 장면은 이제 특정 캐릭터에 종속되지 않으므로
  // 캐릭터를 바꿔도 다시 읽지 않는다. 구 스키마는 피규어 1체로 승격된다.
  useEffect(() => {
    const restored = loadPose();
    // ?character=<id> 딥링크(캐릭터 상세 → "이 캐릭터로 만들기")는 첫 피규어에 배정.
    const next: PoseState = initialCharId
      ? {
          ...restored,
          figures: restored.figures.map((f, i) =>
            i === 0 ? { ...f, characterId: initialCharId } : f,
          ),
        }
      : restored;
    setPose(next);
    setSelection({ figureId: next.figures[0].id, bone: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = setTimeout(() => savePose(pose), 300);
    return () => clearTimeout(t);
  }, [pose]);

  // 아직 아무 피규어에도 캐릭터가 없으면 첫 캐릭터로 채워 준다
  // (기존의 "첫 캐릭터 자동 선택"과 같은 편의).
  const seedFirstCharacter = useCallback((items: CharacterWithUrls[]) => {
    const first = items[0]?.id;
    if (!first) return;
    setPose((p) =>
      p.figures.some((f) => f.characterId)
        ? p
        : {
            ...p,
            figures: p.figures.map((f, i) =>
              i === 0 ? { ...f, characterId: first } : f,
            ),
          },
    );
  }, []);

  // 부트스트랩: 세션 확인 → (로그인) 로컬 캐릭터 동기화 + 서버 목록 + pending 재개,
  //             (미로그인) 로컬 캐릭터 목록. lazy-auth 흐름의 핵심.
  useEffect(() => {
    if (bootRef.current) return;
    bootRef.current = true;
    (async () => {
      const { data } = await browserSupabase().auth.getUser();
      const isAuthed = !!data.user;
      setAuthed(isAuthed);

      if (!isAuthed) {
        // 미로그인: 브라우저 로컬 캐릭터로 동작
        const locals = await listLocalCharacters().catch(() => []);
        const items = locals.map(localToCharacter);
        setCharacters(items);
        seedFirstCharacter(items);
        return;
      }

      // 로그인: 로컬 캐릭터가 있으면 서버로 이관
      const pending = takePendingGeneration();
      let mapping = new Map<string, string>();
      // 로컬 캐릭터는 조용히 계정으로 이관 (사용자에겐 구분 없는 경험)
      const locals = await listLocalCharacters().catch(() => []);
      if (locals.length) {
        mapping = await syncLocalCharactersToServer();
      }

      try {
        const r = await fetch("/api/characters");
        const json = await r.json();
        if (!r.ok) throw new Error(json.error ?? "load failed");
        const items: CharacterWithUrls[] = json.items;
        setCharacters(items);

        // pending 생성 재개: 가입 전 만든 장면/옵션 복원 → 자동 생성.
        // 이관으로 바뀐 id를 피규어 전원에 갈아 끼운다 — 하나라도 local:*로
        // 남으면 그 캐릭터를 못 찾아 생성이 404로 실패한다.
        const restored = pending
          ? remapFigureCharacters(pending.pose, mapping)
          : null;
        const known = new Set(items.map((c) => c.id));
        const resumable =
          !!restored &&
          restored.figures.every(
            (f) => f.characterId && known.has(f.characterId),
          );

        if (pending && restored && resumable) {
          setPose(restored);
          setSelection({ figureId: restored.figures[0].id, bone: null });
          setProvider(pending.provider);
          setExtraPrompt(pending.extraPrompt);
          toast.info("가입 완료! 요청했던 이미지를 이어서 생성할게요.");
          setResumeArmed(true);
        } else {
          seedFirstCharacter(items);
        }
      } catch (e) {
        toast.error(`캐릭터 불러오기 실패: ${(e as Error).message}`);
        setCharacters([]);
      }
      refreshQuota();
    })();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 가입 후 자동 재개: 복원된 포즈가 3D 씬에 반영될 시간을 준 뒤 생성 실행.
  // 주의: 플래그는 타이머 발화 "후"에 내린다 — 먼저 내리면 cleanup이 타이머를 취소함.
  useEffect(() => {
    if (!resumeArmed || busy) return;
    const t = setTimeout(() => {
      setResumeArmed(false);
      generate();
    }, 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumeArmed]);

  const selectedFigureId = selection?.figureId ?? null;
  const selectedBone = selection?.bone ?? null;

  const selectedFigure = useMemo(
    () => pose.figures.find((f) => f.id === selectedFigureId) ?? null,
    [pose.figures, selectedFigureId],
  );

  // 피규어 하나만 갈아 끼우는 공통 갱신자. 모든 포즈/배치 변경이 여기를 지난다.
  const updateFigure = useCallback(
    (figureId: string, fn: (f: Figure) => Figure) => {
      setPose((p) => ({
        ...p,
        figures: p.figures.map((f) => (f.id === figureId ? fn(f) : f)),
      }));
    },
    [],
  );

  // Slider path: apply per-axis human range-of-motion limits.
  const setRotation = useCallback(
    (name: string, rot: [number, number, number]) => {
      if (!selectedFigureId) return;
      const clamped = clampRotation(name, rot);
      updateFigure(selectedFigureId, (f) => ({
        ...f,
        bones: { ...f.bones, [name]: clamped },
      }));
    },
    [selectedFigureId, updateFigure],
  );

  // Gizmo path: store free 3D rotation as-is (clamping here causes the rotation
  // to snap onto the wrong axis at gimbal lock). 피규어 id는 씬이 알려 준다.
  const onRotateBone = useCallback(
    (figureId: string, bone: string, rot: [number, number, number]) => {
      updateFigure(figureId, (f) => ({
        ...f,
        bones: { ...f.bones, [bone]: rot },
      }));
    },
    [updateFigure],
  );

  const onTransformFigure = useCallback(
    (
      figureId: string,
      patch: { position?: [number, number, number]; rotationY?: number },
    ) => {
      updateFigure(figureId, (f) => ({ ...f, ...patch }));
    },
    [updateFigure],
  );

  const applyPresetById = useCallback(
    (presetId: string) => {
      const preset = PRESETS.find((p) => p.id === presetId);
      if (!preset || !selectedFigureId) return;
      updateFigure(selectedFigureId, (f) => ({
        ...f,
        bones: applyPreset(f.bones, preset),
        // 앉기·무릎 꿇기는 피규어를 내려 줘야 바닥에 앉은 것처럼 보인다.
        // 지정이 없는 자세는 지면(0)으로 되돌린다.
        position: [f.position[0], preset.groundY ?? 0, f.position[2]],
      }));
    },
    [selectedFigureId, updateFigure],
  );

  // Apply a saved pose's bones (clamped) as a complete replacement.
  const applyBones = useCallback(
    (bones: Record<string, [number, number, number]>) => {
      if (!selectedFigureId) return;
      const next: Record<string, [number, number, number]> = {};
      for (const [name, rot] of Object.entries(bones)) {
        next[name] = clampRotation(name, rot);
      }
      updateFigure(selectedFigureId, (f) => ({ ...f, bones: next }));
    },
    [selectedFigureId, updateFigure],
  );

  const resetBone = useCallback(
    (name: string) => {
      if (!selectedFigureId) return;
      updateFigure(selectedFigureId, (f) => {
        const bones = { ...f.bones };
        delete bones[name];
        return { ...f, bones };
      });
    },
    [selectedFigureId, updateFigure],
  );

  // 선택한 피규어의 포즈만 초기화. 장면 구성·배치·카메라·출력 설정은 유지.
  const resetFigurePose = useCallback(() => {
    if (!selectedFigureId) return;
    updateFigure(selectedFigureId, (f) => ({ ...f, bones: {} }));
  }, [selectedFigureId, updateFigure]);

  const resetPlacement = useCallback(() => {
    if (!selectedFigureId) return;
    updateFigure(selectedFigureId, (f) => ({
      ...f,
      position: [0, 0, 0],
      rotationY: 0,
      scale: 1,
    }));
  }, [selectedFigureId, updateFigure]);

  const setFigureScale = useCallback(
    (scale: number) => {
      if (!selectedFigureId) return;
      updateFigure(selectedFigureId, (f) => ({ ...f, scale }));
    },
    [selectedFigureId, updateFigure],
  );

  // 접지 높이. 프리셋이 넣어 준 값을 관절을 직접 고친 뒤 다시 맞출 때 쓴다
  // (이동 기즈모는 바닥면 전용이라 높이를 못 건드린다).
  const setFigureHeight = useCallback(
    (y: number) => {
      if (!selectedFigureId) return;
      updateFigure(selectedFigureId, (f) => ({
        ...f,
        position: [f.position[0], y, f.position[2]],
      }));
    },
    [selectedFigureId, updateFigure],
  );

  const addFigure = useCallback(() => {
    if (pose.figures.length >= MAX_FIGURES) return;
    const id = nanoid(8);
    setPose((p) => {
      if (p.figures.length >= MAX_FIGURES) return p;
      // 기존 피규어와 겹치지 않게 오른쪽으로 벌려 세운다.
      const rightmost = p.figures.reduce(
        (m, f) => Math.max(m, f.position[0]),
        0,
      );
      const next: Figure = {
        id,
        characterId: null,
        bones: {},
        position: [rightmost + FIGURE_SPACING, 0, 0],
        rotationY: 0,
        scale: 1,
      };
      return { ...p, figures: [...p.figures, next] };
    });
    setSelection({ figureId: id, bone: null });
  }, [pose.figures.length]);

  // 2인 구도 프리셋 — 앞의 두 피규어에 뼈·배치·방향을 한 번에 적용한다.
  const applyDuoPreset = useCallback(
    (id: string) => {
      const preset = DUO_PRESETS.find((p) => p.id === id);
      if (!preset) return;
      const needsPartner = pose.figures.length < 2;
      // id는 updater 밖에서 만든다 — StrictMode의 이중 호출로 서로 다른 id가
      // 생기면 방금 추가한 피규어를 두 번 만들게 된다.
      const partnerId = nanoid(8);
      setPose((p) => {
        const figures =
          p.figures.length >= 2
            ? p.figures
            : [
                ...p.figures,
                {
                  id: partnerId,
                  characterId: null,
                  bones: {},
                  position: [FIGURE_SPACING, 0, 0] as [number, number, number],
                  rotationY: 0,
                  scale: 1,
                },
              ];
        const [a, b, ...rest] = figures;
        return {
          ...p,
          figures: [
            { ...a, ...placementToFigurePatch(preset.left) },
            { ...b, ...placementToFigurePatch(preset.right) },
            ...rest,
          ],
        };
      });
      if (needsPartner)
        toast.info("상대역 피규어를 추가했어요", {
          description: "왼쪽 목록에서 캐릭터를 배정해주세요.",
        });
    },
    [pose.figures.length],
  );

  const removeFigure = useCallback((figureId: string) => {
    setPose((p) =>
      p.figures.length <= 1
        ? p // 장면에는 최소 한 명이 있어야 한다
        : { ...p, figures: p.figures.filter((f) => f.id !== figureId) },
    );
    setSelection((s) => (s?.figureId === figureId ? null : s));
  }, []);

  const assignCharacter = useCallback(
    (figureId: string, characterId: string) => {
      updateFigure(figureId, (f) => ({ ...f, characterId }));
      setSelection((s) => s ?? { figureId, bone: null });
    },
    [updateFigure],
  );

  const selectFigure = useCallback((figureId: string) => {
    setSelection({ figureId, bone: null });
  }, []);

  // 관절 모드를 벗어나면 관절 선택을 풀어 피규어 기즈모로 전환한다.
  const changeEditMode = useCallback((next: EditMode) => {
    setEditMode(next);
    if (next !== "bone") setSelection((s) => (s ? { ...s, bone: null } : s));
  }, []);

  const selectBoneFromPanel = useCallback(
    (name: string | null) => {
      if (!selectedFigureId) return;
      setEditMode("bone");
      setSelection({ figureId: selectedFigureId, bone: name });
    },
    [selectedFigureId],
  );

  const registerCapture = useCallback((fn: () => CaptureResult) => {
    captureRef.current = fn;
  }, []);

  const rawCapture = useCallback(
    () => captureRef.current?.().dataUrl ?? "",
    [],
  );

  const characterById = useMemo(
    () => new Map((characters ?? []).map((c) => [c.id, c])),
    [characters],
  );

  // 결과 화면의 "갤러리에서 보기" 링크가 향할 대표 캐릭터.
  const primaryCharacter = useMemo(() => {
    const id = pose.figures.find((f) => f.characterId)?.characterId;
    return id ? (characterById.get(id) ?? null) : null;
  }, [pose.figures, characterById]);

  const sceneLabel = useMemo(
    () =>
      pose.figures
        .map((f) =>
          f.characterId
            ? (characterById.get(f.characterId)?.name ?? "삭제됨")
            : "미배정",
        )
        .join(" · "),
    [pose.figures, characterById],
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

  // Capture raw canvas → apply lens distortion → final dataURL + 화면 배치.
  async function captureFinal(): Promise<CaptureResult> {
    const raw = captureRef.current?.();
    if (!raw?.dataUrl) throw new Error("캔버스 캡처 실패");
    return {
      dataUrl: await applyDistortion(
        raw.dataUrl,
        pose.distortion.type,
        pose.distortion.strength,
      ),
      layout: raw.layout,
    };
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
    // 장면의 모든 피규어에 캐릭터가 배정돼 있어야 한다 — 서버도 같은 규칙으로
    // 400을 돌려주지만, 여기서 먼저 걸러 캡처/업로드를 낭비하지 않는다.
    if (pose.figures.some((f) => !f.characterId)) {
      toast.error("모든 피규어에 캐릭터를 배정하세요");
      return;
    }
    // lazy-auth: 미로그인이면 현재 작업 스냅샷을 저장하고 가입 유도.
    // 가입 완료 후 홈 복귀 시 자동으로 이어서 생성된다(부트스트랩 재개).
    if (!authed) {
      savePendingGeneration({ provider, extraPrompt, pose });
      toast.info("무료로 생성하려면 로그인이 필요해요", {
        description: "로그인하면 지금 만든 장면으로 바로 생성됩니다.",
      });
      router.push("/login");
      return;
    }
    setBusy(true);
    setResultUrl(null);
    setGenError(null);
    setGenStatus("queued");
    try {
      const { dataUrl, layout } = await captureFinal();
      const r = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          poseRenderDataUrl: dataUrl,
          pose,
          // 마네킹↔캐릭터를 잇는 근거. 서버가 이걸로 프롬프트의 위치 서술을 만든다.
          layout,
          extraPrompt,
        }),
      });
      const json = await r.json();
      if (!r.ok) {
        if (json.code === "QUOTA_EXCEEDED") {
          toast.error("무료 생성 횟수를 모두 사용했어요", {
            description: "결제 기능이 준비되면 더 생성할 수 있어요.",
            duration: 8000,
          });
        } else {
          toast.error(json.error ?? "생성 요청 실패", { duration: 8000 });
        }
        return;
      }
      await pollGeneration(json.generationId);
      refreshQuota();
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
      const { dataUrl } = await captureFinal();
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = "pose-preview.png";
      a.click();
    } catch (e) {
      toast.error(`캡처 실패: ${(e as Error).message}`);
    }
  }

  return (
    <main
      className={[
        "grid grid-cols-1 lg:h-[calc(100dvh-57px)] lg:grid-rows-[minmax(0,1fr)]",
        resultUrl
          ? "lg:grid-cols-[1fr_380px]"
          : "lg:grid-cols-[260px_1fr_380px]",
      ].join(" ")}
    >
      {/* Left panel — 장면 구성 (결과 뷰에서는 숨김) */}
      {!resultUrl && (
        <aside className="flex h-full flex-col gap-4 overflow-y-auto border-r border-[var(--border)] bg-[var(--background)] p-4">
          <SceneFigures
            figures={pose.figures}
            characters={characters ?? []}
            selectedFigureId={selectedFigureId}
            loading={characters === null}
            onSelectFigure={selectFigure}
            onAddFigure={addFigure}
            onRemoveFigure={removeFigure}
            onAssignCharacter={assignCharacter}
          />
        </aside>
      )}

      {/* Center — 포즈 에디터 + (결과 시) 생성 이미지가 메인 */}
      <div className="flex min-h-[50vh] flex-col overflow-hidden bg-[var(--background)] lg:flex-row">
        {/* 3D 포즈: 결과가 있으면 좁은 왼쪽 사이드(모바일은 상단), 없으면 중앙 전체 */}
        <div
          className={[
            "relative flex items-center justify-center overflow-hidden p-4",
            resultUrl
              ? "flex-1 border-b border-[var(--border)] lg:w-64 lg:flex-none lg:shrink-0 lg:border-b-0 lg:border-r"
              : "flex-1",
          ].join(" ")}
          style={{ containerType: "size" }}
        >
          <div
            className={[
              "relative overflow-hidden rounded-lg border border-[var(--border)] bg-black",
              // 결과 뷰: 캔버스 고정 — 포즈/카메라 조작 불가(정적 스냅샷)
              resultUrl ? "pointer-events-none" : "",
            ].join(" ")}
            style={{
              // Contain-fit the chosen aspect ratio inside the container.
              width: `min(100cqw, calc(100cqh * ${arNum}))`,
              height: `min(100cqh, calc(100cqw / ${arNum}))`,
            }}
          >
            <PoseScene
              pose={pose}
              selection={selection}
              figureMode={editMode === "rotate" ? "rotate" : "translate"}
              boneEditing={editMode === "bone"}
              onSelect={setSelection}
              onRotateBone={onRotateBone}
              onTransformFigure={onTransformFigure}
              registerCapture={registerCapture}
            />
            <div className="pointer-events-none absolute left-2 top-2 rounded-md bg-[var(--surface)]/80 px-2 py-0.5 text-[10px] backdrop-blur">
              {resultUrl
                ? "포즈"
                : `${sceneLabel} · ${aspect} · ${pose.renderMode === "sketch" ? "스케치" : "채색"}${pose.distortion.type !== "none" ? " · 왜곡" : ""}`}
            </div>
          </div>
        </div>

        {/* 생성 이미지 — 중앙 메인 */}
        {resultUrl && (
          <div className="relative flex flex-1 items-center justify-center overflow-hidden p-4">
            <button
              type="button"
              onClick={() => setResultUrl(null)}
              title="편집으로 돌아가기"
              className="absolute right-3 top-3 z-10 rounded-md bg-[var(--surface)]/90 p-1.5 text-[var(--muted)] backdrop-blur transition hover:text-[var(--foreground)]"
            >
              <X size={16} />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={resultUrl}
              alt="생성 결과"
              className="max-h-full max-w-full rounded-lg border border-[var(--border)] object-contain shadow-lg"
            />
            <Link
              href={
                primaryCharacter
                  ? `/characters/${primaryCharacter.id}`
                  : "/gallery"
              }
              className="absolute bottom-3 rounded-md bg-[var(--surface)]/90 px-3 py-1.5 text-xs text-[var(--muted)] backdrop-blur transition hover:text-[var(--foreground)]"
            >
              갤러리에서 보기 →
            </Link>
          </div>
        )}
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
            icon={<Users size={16} />}
            title="피규어"
            badge={
              selectedFigure
                ? (characterById.get(selectedFigure.characterId ?? "")?.name ??
                  "미배정")
                : null
            }
            defaultOpen
          >
            <FigureControls
              figure={selectedFigure}
              mode={editMode}
              onModeChange={changeEditMode}
              onScaleChange={setFigureScale}
              onHeightChange={setFigureHeight}
              onResetPlacement={resetPlacement}
            />
            <DuoPresetsPanel
              figureCount={pose.figures.length}
              onApply={applyDuoPreset}
            />
          </AccordionSection>

          <AccordionSection
            icon={<SlidersHorizontal size={16} />}
            title="세부 조정"
            badge={selectedBoneLabel}
            defaultOpen
          >
            <PosePresets
              currentBones={selectedFigure?.bones ?? {}}
              onApplyPreset={applyPresetById}
              onApplyBones={applyBones}
            />
            <BonePanel
              selected={selectedBone}
              rotations={selectedFigure?.bones ?? {}}
              onSelect={selectBoneFromPanel}
              onRotate={setRotation}
              onResetBone={resetBone}
              onResetAll={resetFigurePose}
            />
          </AccordionSection>

          <AccordionSection
            icon={<Palette size={16} />}
            title="출력 스타일"
            forceOpen={busy || !!genError}
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
          </AccordionSection>
        </div>

        {/* Persistent action footer */}
        <div className="shrink-0 space-y-2 border-t border-[var(--border)] p-4">
          <p className="text-center text-[10px] text-[var(--muted)]">
            {demo
              ? "🎬 시연 모드 — 무제한 생성 (지정 이미지)"
              : quotaUnlimited
                ? "무제한 생성"
                : authed === false
              ? "가입하면 무료 생성 — 포즈 2회 · 컨셉아트 1회"
              : quotaLeft !== null
                ? `남은 무료 생성 ${quotaLeft}회`
                : " "}
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
