import { z } from "zod";
import { INTERACTION_RELATIONS, POSE_LANGUAGE_DATA_MAP, poseIntentToState, type PoseBoneId, type PoseIntentDraft } from "./natural-language-map";
import { MAX_FIGURES, type PoseState } from "@/types/pose";

const vector = z.tuple([z.number().finite(), z.number().finite(), z.number().finite()]);
const bone = z.string().refine((value) => Object.hasOwn(POSE_LANGUAGE_DATA_MAP.joints, value), "지원하지 않는 관절입니다");
const endpoint = z.object({ figureId: z.string(), joint: bone });
const draftSchema = z.object({
  schema: z.literal("clicktoon.pose-intent/v1"),
  figures: z.array(z.object({
    id: z.string().trim().min(1),
    role: z.string().optional(),
    joints: z.record(bone, vector),
    placement: z.object({ position: vector, yawDegrees: z.number().finite(), scale: z.number().finite().optional() }),
  })).min(1).max(MAX_FIGURES),
  interaction: z.object({
    relation: z.enum(INTERACTION_RELATIONS),
    description: z.string().optional(),
    contacts: z.array(z.object({
      source: endpoint,
      target: endpoint,
      kind: z.enum(["touch", "hold", "support", "block", "near"]),
      maxDistance: z.number().finite().nonnegative().optional(),
    })).optional(),
  }).optional(),
});

/** Untrusted pasted JSON enters here; existing editor/conversion logic stays untouched. */
export function adaptDebugPose(text: string, current: PoseState) {
  const unfenced = text.trim().replace(/^```(?:json)?\s*\n([\s\S]*?)\n```$/i, "$1");
  let raw: unknown;
  try { raw = JSON.parse(unfenced); }
  catch { throw new Error("JSON 문법을 확인하세요. 따옴표·쉼표·괄호가 올바른지 확인해 주세요."); }
  const parsed = draftSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((issue) => `${issue.path.join(".") || "입력"}: ${issue.message}`).join("\n"));
  }
  const draft = parsed.data as PoseIntentDraft;
  const converted = poseIntentToState(draft);
  // Match by array order, not model-generated ids. Never accept character ids from AI.
  const figures = converted.figures.map((figure, index) => ({
    ...figure,
    id: current.figures[index]?.id ?? crypto.randomUUID(),
    characterId: current.figures[index]?.characterId ?? null,
  }));
  const warnings: string[] = [];
  converted.figures.forEach((figure, index) => {
    const source = draft.figures[index];
    for (const [joint, values] of Object.entries(source.joints)) {
      if (values?.some((value, axis) => Math.abs(value) > POSE_LANGUAGE_DATA_MAP.joints[joint as PoseBoneId].limitsDegrees[axis]))
        warnings.push(`${source.id}.${joint}: 관절 한계로 보정됨`);
    }
    if (figure.position[1] !== source.placement.position[1] || figure.scale !== (source.placement.scale ?? 1))
      warnings.push(`${source.id}: 높이 또는 크기가 허용 범위로 보정됨`);
  });
  return { pose: { ...current, figures }, draft, warnings };
}

export function exportDebugPose(pose: PoseState): PoseIntentDraft {
  return {
    schema: "clicktoon.pose-intent/v1",
    figures: pose.figures.map((figure) => ({
      id: figure.id,
      joints: Object.fromEntries(Object.entries(figure.bones)
        .filter(([key]) => Object.hasOwn(POSE_LANGUAGE_DATA_MAP.joints, key))
        .map(([key, values]) => [key, values.map((value) => value * 180 / Math.PI)])),
      placement: { position: figure.position, yawDegrees: figure.rotationY * 180 / Math.PI, scale: figure.scale },
    })),
  };
}

export const DEBUG_POSE_EXAMPLE: PoseIntentDraft = {
  schema: "clicktoon.pose-intent/v1",
  figures: [
    { id: "speaker", role: "말하는 사람", joints: { shoulder_l: [0, -26, -58], elbow_l: [59, -37, 0], shoulder_r: [0, 0, -78] }, placement: { position: [-0.52, 0, 0], yawDegrees: 68, scale: 1 } },
    { id: "listener", role: "듣는 사람", joints: { shoulder_l: [0, 0, -78], shoulder_r: [0, 0, -78] }, placement: { position: [0.52, 0, 0], yawDegrees: -68, scale: 1 } },
  ],
  interaction: { relation: "facing", description: "두 사람이 마주 보고 대화한다" },
};

export function debugPoseContext() {
  return [
    "계산 지침: calculationGuide를 먼저 읽고 인물별 배치 → 팔마다 up/fwd/bend 선택 → 공식 계산 → 관절 한계 점검 순서로 작업하세요. 설명을 붙인 것만으로 접촉 자세가 완성됐다고 간주하지 마세요. formulas/examples는 후보 생성 규칙이며 정확한 손 위치를 보장하지 않습니다.",
    "요청한 자세를 아래 데이터 맵에 맞춰 JSON만 출력하세요. 관절과 yaw는 도 단위입니다. figures는 1~3개이며 배열 순서로 기존 인물에 적용됩니다. 누락 관절은 T 포즈로 초기화되므로 팔을 내릴 때 shoulder_l/r도 명시하세요. characterId는 출력하지 마세요. 접촉 메타데이터는 의도이며 IK가 아닙니다.",
    JSON.stringify(POSE_LANGUAGE_DATA_MAP, null, 2),
    "출력 형식 예시:",
    "interaction.relation은 interactionRelations 목록 중 하나만 사용하세요. 일반적인 신체 접촉은 touching, 받쳐 주는 동작은 support입니다. description은 설명 메타데이터이며 관절을 자동 조정하지 않습니다.",
    JSON.stringify(DEBUG_POSE_EXAMPLE, null, 2),
    "원하는 자세: ",
  ].join("\n\n");
}
