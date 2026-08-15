import { z } from "zod";

const triple = z.tuple([z.number(), z.number(), z.number()]);

export const POSE_MODEL_ID = "skinned-v3";

// 한 장면에 세울 수 있는 마네킹 수. 레퍼런스 이미지가 늘수록 캐릭터 정체성
// 유지가 약해지므로 품질 안전선으로 3체까지만 허용한다.
export const MAX_FIGURES = 3;

export const FIGURE_SCALE_MIN = 0.4;
export const FIGURE_SCALE_MAX = 2;

// 피규어 높이(position[1])의 조절 범위. 0이 지면이다.
// 아래로는 바닥에 앉는 자세(가장 깊은 프리셋이 −0.46)를 덮을 만큼,
// 위로는 점프·비행 연출을 할 만큼 잡았다.
export const FIGURE_Y_MIN = -0.9;
export const FIGURE_Y_MAX = 1.5;

// 새 피규어를 세울 때 기존 피규어와 겹치지 않도록 벌리는 간격(월드 단위, 키 1.7 기준).
export const FIGURE_SPACING = 0.8;

// Output canvas aspect ratios → pixel sizes for generation.
export const CANVAS_SIZES = {
  "1:1": { w: 1024, h: 1024, label: "정사각 1:1" },
  "3:4": { w: 864, h: 1152, label: "세로 3:4" },
  "4:3": { w: 1152, h: 864, label: "가로 4:3" },
  "9:16": { w: 768, h: 1344, label: "세로 9:16" },
  "16:9": { w: 1344, h: 768, label: "가로 16:9" },
} as const;

export type CanvasAspect = keyof typeof CANVAS_SIZES;

// 장면에 선 마네킹 1체. 어떤 캐릭터를 연기하는지(characterId)와 자기만의
// 포즈(bones) · 배치(position/rotationY/scale)를 각자 들고 있다.
export const figureSchema = z.object({
  id: z.string(),
  characterId: z.string().nullable().default(null),
  bones: z.record(z.string(), triple).default({}),
  // 바닥면 위 배치. 이동 기즈모가 XZ 전용이라 y는 항상 0이다.
  position: triple.default([0, 0, 0]),
  // 좌우 회전(yaw, radian). 두 캐릭터가 마주 보는 구도를 만드는 축.
  rotationY: z.number().default(0),
  scale: z.number().min(FIGURE_SCALE_MIN).max(FIGURE_SCALE_MAX).default(1),
});

export type Figure = z.infer<typeof figureSchema>;

// 피규어가 아니라 "장면"에 속하는 값들 — 카메라·조명·왜곡·출력 설정.
// 현행 스키마와 레거시 스키마가 공유하므로 따로 뽑아 둔다.
const sceneFields = {
  // 2D light, expressed relative to the output canvas frame.
  // x: -1 (left) .. 1 (right); y: -1 (bottom) .. 1 (top).
  light2d: z
    .object({
      x: z.number().min(-1).max(1).default(-0.5),
      y: z.number().min(-1).max(1).default(0.6),
      intensity: z.number().min(0).max(6).default(1.6),
      color: z.string().default("#ffffff"),
    })
    .default({ x: -0.5, y: 0.6, intensity: 1.6, color: "#ffffff" }),
  camera: z
    .object({
      position: triple.default([0, 1.4, 4]),
      target: triple.default([0, 1, 0]),
      fov: z.number().min(10).max(120).default(50),
    })
    .default({ position: [0, 1.4, 4], target: [0, 1, 0], fov: 50 }),
  // Lens distortion applied at capture / generation time.
  distortion: z
    .object({
      type: z
        .enum(["none", "bulge", "pinch", "swirl", "wave", "fisheye"])
        .default("none"),
      strength: z.number().min(0).max(1).default(0.5),
    })
    .default({ type: "none", strength: 0.5 }),
  // Output style: "sketch" = line art only, "color" = full color + shading.
  renderMode: z.enum(["sketch", "color"]).default("color"),
  aspect: z.enum(["1:1", "3:4", "4:3", "9:16", "16:9"]).default("3:4"),
};

export const poseStateSchema = z.object({
  modelId: z.string().default(POSE_MODEL_ID),
  figures: z.array(figureSchema).min(1).max(MAX_FIGURES),
  ...sceneFields,
});

export type PoseState = z.infer<typeof poseStateSchema>;

// skinned-v2 이하 — 피규어 1체분 포즈(bones/rootPosition)가 최상위에 평평하게
// 놓여 있던 형태. localStorage와 기존 generations.pose 행에 남아 있다.
const legacyPoseSchema = z.object({
  modelId: z.string().default("skinned-v2"),
  bones: z.record(z.string(), triple).default({}),
  rootPosition: triple.default([0, 0, 0]),
  ...sceneFields,
});

export const POSE_STORAGE_KEY = "omc:pose:last";

export const DEFAULT_FIGURE_ID = "f1";

// 주의: 모듈 로드 시점에 평가되므로 랜덤/시각 의존 값을 쓰면 SSR-클라이언트
// 하이드레이션이 어긋난다. 기본 피규어 id는 반드시 고정값.
export const DEFAULT_POSE: PoseState = {
  modelId: POSE_MODEL_ID,
  figures: [
    {
      id: DEFAULT_FIGURE_ID,
      characterId: null,
      bones: {},
      position: [0, 0, 0],
      rotationY: 0,
      scale: 1,
    },
  ],
  light2d: { x: -0.5, y: 0.6, intensity: 1.6, color: "#ffffff" },
  camera: { position: [0, 1.4, 4], target: [0, 1, 0], fov: 50 },
  distortion: { type: "none", strength: 0.5 },
  renderMode: "color",
  aspect: "3:4",
};

// 저장된 포즈(localStorage · generations.pose)를 현재 스키마로 읽는다.
// 날 poseStateSchema.parse() 대신 항상 이걸 쓸 것 — 구 스키마 데이터가
// 클라이언트(localStorage)와 서버(기존 DB 행, 재시도 경로) 양쪽에 남아 있다.
export function parsePoseState(raw: unknown): PoseState {
  const obj =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : null;

  // 레거시 판별은 modelId가 아니라 형태로 한다. modelId가 유실·조작된 신규
  // 데이터를 레거시로 오인해 figures를 통째로 버리는 사고를 막기 위함.
  if (obj && !("figures" in obj) && "bones" in obj) {
    const legacy = legacyPoseSchema.safeParse(raw);
    if (legacy.success) {
      const { bones, rootPosition, ...scene } = legacy.data;
      return {
        ...scene,
        modelId: POSE_MODEL_ID,
        figures: [
          {
            id: DEFAULT_FIGURE_ID,
            characterId: null,
            bones,
            position: rootPosition,
            rotationY: 0,
            scale: 1,
          },
        ],
      };
    }
  }

  const parsed = poseStateSchema.safeParse(raw);
  return parsed.success ? { ...parsed.data, modelId: POSE_MODEL_ID } : DEFAULT_POSE;
}

export type DistortionType = PoseState["distortion"]["type"];
export type RenderMode = PoseState["renderMode"];

// 캡처 시점 각 피규어의 화면 위치. 프롬프트에서 "왼쪽 마네킹 = [IMAGE 1]"처럼
// 마네킹과 캐릭터를 이어 주는 근거이며, 생성 요청과 함께 서버로 보내진다.
//
// 서버가 pose.camera로 다시 계산할 수는 없다 — OrbitControls가 pose.camera에
// 되쓰지 않아, 사용자가 카메라를 돌리면 저장된 값과 실제 렌더가 어긋난다.
export const figureLayoutSchema = z.object({
  figureId: z.string(),
  /** 화면 정규화 좌표. x: 0(왼쪽) ~ 1(오른쪽), y: 0(위) ~ 1(아래) */
  x: z.number(),
  y: z.number(),
  /** 카메라로부터의 거리 — 좌우가 비슷할 때 앞/뒤를 가르는 데 쓴다. */
  depth: z.number(),
});

export type FigureLayout = z.infer<typeof figureLayoutSchema>;

// ── 에디터 UI 상태 (저장되지 않음) ──

/** 선택 대상. bone이 null이면 피규어 자체(배치 조작), 아니면 그 관절. */
export type Selection = { figureId: string; bone: string | null };

/** 피규어를 직접 다룰 때의 조작 모드. 관절 선택 중에는 무시된다. */
export type FigureMode = "translate" | "rotate";

// Map the 2D light (canvas-relative) to a 3D position for scene preview only.
// The light sits in front of the figure, offset by the 2D coordinates.
export function light2dToScenePosition(light: {
  x: number;
  y: number;
}): [number, number, number] {
  return [light.x * 4, 1 + light.y * 3, 3.5];
}
