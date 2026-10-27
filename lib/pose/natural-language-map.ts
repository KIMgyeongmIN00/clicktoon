import { POSE_CALCULATION_GUIDE } from "./calculation-guide";
import {
  DEFAULT_POSE,
  FIGURE_SCALE_MAX,
  FIGURE_SCALE_MIN,
  FIGURE_Y_MAX,
  FIGURE_Y_MIN,
  type PoseState,
} from "@/types/pose";

/**
 * Natural-language pose contract for the skinned-v3 Bony rig.
 *
 * The editor stores rotations in radians, but language models should emit the
 * degrees-based PoseIntentDraft shape below. `poseIntentToState` is the only
 * conversion boundary: it clamps the draft to this rig's safe ranges and
 * produces the persisted PoseState shape used by the editor and generation API.
 */

export type AxisDegrees = [number, number, number];
export type Vec3 = [number, number, number];

export type PoseBoneId =
  | "root"
  | "spine"
  | "chest"
  | "neck"
  | "head"
  | "shoulder_l"
  | "elbow_l"
  | "wrist_l"
  | "thumb_l1"
  | "thumb_l2"
  | "thumb_l3"
  | "finger1_l1"
  | "finger1_l2"
  | "finger1_l3"
  | "finger2_l1"
  | "finger2_l2"
  | "finger2_l3"
  | "shoulder_r"
  | "elbow_r"
  | "wrist_r"
  | "thumb_r1"
  | "thumb_r2"
  | "thumb_r3"
  | "finger1_r1"
  | "finger1_r2"
  | "finger1_r3"
  | "finger2_r1"
  | "finger2_r2"
  | "finger2_r3"
  | "hip_l"
  | "knee_l"
  | "ankle_l"
  | "hip_r"
  | "knee_r"
  | "ankle_r";

export type PoseIntentFigure = {
  /** Stable caller-supplied identifier. It must be unique within the scene. */
  id: string;
  /** Optional semantic role for an LLM, e.g. "speaker" or "receiver". */
  role?: string;
  /** Character id is assigned by the application, not invented by the LLM. */
  characterId?: string | null;
  /** Rotation deltas from the rig rest pose, in degrees. Omitted bones stay at rest. */
  joints: Partial<Record<PoseBoneId, AxisDegrees>>;
  /** World placement: x=screen right, y=up, z=toward the camera. */
  placement: {
    position: Vec3;
    /** World yaw in degrees: 0 faces +Z (camera), +90 faces +X (screen right). */
    yawDegrees: number;
    scale?: number;
  };
};

export type ContactIntent = {
  source: { figureId: string; joint: PoseBoneId };
  target: { figureId: string; joint: PoseBoneId };
  /** The contact is an artistic target, not a collision or IK constraint. */
  kind: "touch" | "hold" | "support" | "block" | "near";
  maxDistance?: number;
};

export const INTERACTION_RELATIONS = [
  "none", "facing", "side_by_side", "back_to_back", "approach",
  "embrace", "handshake", "high_five", "combat", "support", "touching",
] as const;

export type InteractionIntent = {
  relation: (typeof INTERACTION_RELATIONS)[number];
  /** Directional action, e.g. "speaker gestures to listener". */
  description?: string;
  contacts?: ContactIntent[];
};

export type PoseIntentDraft = {
  schema: "clicktoon.pose-intent/v1";
  figures: PoseIntentFigure[];
  interaction?: InteractionIntent;
};

export type JointSemantic = {
  group: string;
  /** What the three local axes mean for this particular rig, in Korean. */
  axes: [string, string, string];
  /** Per-axis safe range in degrees, relative to the rest orientation. */
  limitsDegrees: [number, number, number];
};

const limb: JointSemantic = {
  group: "사지",
  axes: ["로컬 X", "로컬 Y", "로컬 Z"],
  limitsDegrees: [120, 120, 120],
};
const finger: JointSemantic = {
  group: "손가락",
  axes: ["로컬 X", "로컬 Y", "로컬 Z"],
  limitsDegrees: [100, 100, 100],
};

/**
 * The model-facing map. Axis meanings are calibrated against the actual Bony
 * GLB hierarchy, not generic human-anatomy axes. Use the semantic helpers in
 * the documentation for arms and legs rather than assuming mirroring.
 */
export const POSE_LANGUAGE_DATA_MAP: {
  schema: "clicktoon.pose-intent/v1";
  coordinateFrame: Record<string, string>;
  joints: Record<PoseBoneId, JointSemantic>;
  interactionRelations: readonly string[];
  interactionRules: string[];
  calculationGuide: typeof POSE_CALCULATION_GUIDE;
} = {
  schema: "clicktoon.pose-intent/v1",
  interactionRelations: INTERACTION_RELATIONS,
  calculationGuide: POSE_CALCULATION_GUIDE,
  coordinateFrame: {
    rotationUnit: "Draft rotations are degrees; persisted PoseState rotations are radians.",
    restPose: "Every joint vector is a local delta from the Bony rig rest pose (T-pose).",
    x: "+X is screen right.",
    y: "+Y is up; y=0 is the ground for a standing figure.",
    z: "+Z points toward the camera; a yaw of 0 faces +Z.",
    yaw: "+90 degrees faces screen right; -90 degrees faces screen left.",
  },
  joints: {
    root: { group: "몸통", axes: ["앞/뒤 기울기", "화면 오른쪽 회전", "화면 오른쪽 기울기"], limitsDegrees: [30, 60, 30] },
    spine: { group: "몸통", axes: ["앞으로 숙임", "화면 오른쪽 비틀기", "화면 왼쪽 기울기"], limitsDegrees: [30, 30, 30] },
    chest: { group: "몸통", axes: ["화면 오른쪽 비틀기", "화면 오른쪽 기울기", "뒤로 젖힘"], limitsDegrees: [25, 25, 25] },
    neck: { group: "몸통", axes: ["화면 오른쪽 회전", "화면 오른쪽 기울기", "고개 들기"], limitsDegrees: [35, 45, 30] },
    head: { group: "몸통", axes: ["화면 오른쪽 회전", "화면 오른쪽 기울기", "고개 들기"], limitsDegrees: [35, 45, 30] },
    shoulder_l: { ...limb, group: "왼팔", axes: ["로컬 X", "뒤쪽 이동", "+위 / -아래" ] },
    elbow_l: { ...limb, group: "왼팔", axes: ["팔 내린 상태의 앞으로 굽힘", "T-포즈 상태의 뒤쪽 굽힘", "바깥쪽 비틀기"] },
    wrist_l: { ...limb, group: "왼팔" },
    thumb_l1: { ...finger, group: "왼손" }, thumb_l2: { ...finger, group: "왼손" }, thumb_l3: { ...finger, group: "왼손" },
    finger1_l1: { ...finger, group: "왼손" }, finger1_l2: { ...finger, group: "왼손" }, finger1_l3: { ...finger, group: "왼손" },
    finger2_l1: { ...finger, group: "왼손" }, finger2_l2: { ...finger, group: "왼손" }, finger2_l3: { ...finger, group: "왼손" },
    shoulder_r: { ...limb, group: "오른팔", axes: ["로컬 X", "뒤쪽 이동", "+위 / -아래" ] },
    elbow_r: { ...limb, group: "오른팔", axes: ["팔 내린 상태의 앞으로 굽힘", "T-포즈 상태의 뒤쪽 굽힘", "바깥쪽 비틀기"] },
    wrist_r: { ...limb, group: "오른팔" },
    thumb_r1: { ...finger, group: "오른손" }, thumb_r2: { ...finger, group: "오른손" }, thumb_r3: { ...finger, group: "오른손" },
    finger1_r1: { ...finger, group: "오른손" }, finger1_r2: { ...finger, group: "오른손" }, finger1_r3: { ...finger, group: "오른손" },
    finger2_r1: { ...finger, group: "오른손" }, finger2_r2: { ...finger, group: "오른손" }, finger2_r3: { ...finger, group: "오른손" },
    hip_l: { ...limb, group: "왼다리", axes: ["+바깥쪽 벌리기", "로컬 Y", "+다리를 앞으로" ] },
    knee_l: { ...limb, group: "왼다리", axes: ["로컬 X", "로컬 Y", "-값이 무릎 굽힘" ] },
    ankle_l: { ...limb, group: "왼다리", axes: ["로컬 X", "로컬 Y", "+발끝 들기" ] },
    hip_r: { ...limb, group: "오른다리", axes: ["+바깥쪽 벌리기", "로컬 Y", "+다리를 앞으로" ] },
    knee_r: { ...limb, group: "오른다리", axes: ["로컬 X", "로컬 Y", "-값이 무릎 굽힘" ] },
    ankle_r: { ...limb, group: "오른다리", axes: ["로컬 X", "로컬 Y", "+발끝 들기" ] },
  },
  interactionRules: [
    "Two-person relations require placement and yaw as well as joint rotations.",
    "For face-to-face scenes, the left figure usually has positive yaw and the right figure negative yaw.",
    "A contact intent records desired contact only. The current rig has no inverse kinematics or collision solver.",
    "Keep figures at most three per scene; use one role per figure and never swap character ids in the conversion layer.",
  ],
};

const degToRad = (degrees: number) => (degrees * Math.PI) / 180;
const clamp = (value: number, minimum: number, maximum: number) =>
  Math.max(minimum, Math.min(maximum, value));

const clampSymmetric = (value: number, maximum: number) =>
  clamp(value, -maximum, maximum);

function normalizeDegrees(degrees: number) {
  return ((degrees + 180) % 360 + 360) % 360 - 180;
}

function isFiniteVec3(value: unknown): value is Vec3 {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every((component) => typeof component === "number" && Number.isFinite(component))
  );
}

function radiansForJoint(joint: PoseBoneId, degrees: AxisDegrees): [number, number, number] {
  const limits = POSE_LANGUAGE_DATA_MAP.joints[joint].limitsDegrees;
  return [
    degToRad(clampSymmetric(degrees[0], limits[0])),
    degToRad(clampSymmetric(degrees[1], limits[1])),
    degToRad(clampSymmetric(degrees[2], limits[2])),
  ];
}

function validateInteractionIntent(draft: PoseIntentDraft) {
  if (!draft.interaction) return;

  const figureIds = new Set(draft.figures.map((figure) => figure.id));
  for (const contact of draft.interaction.contacts ?? []) {
    if (!figureIds.has(contact.source.figureId) || !figureIds.has(contact.target.figureId))
      throw new Error("Every contact must reference figures in this pose intent");
    if (
      !POSE_LANGUAGE_DATA_MAP.joints[contact.source.joint] ||
      !POSE_LANGUAGE_DATA_MAP.joints[contact.target.joint]
    )
      throw new Error("Every contact must use a supported joint");
    if (contact.maxDistance !== undefined && (!Number.isFinite(contact.maxDistance) || contact.maxDistance < 0))
      throw new Error("contact.maxDistance must be a non-negative finite number");
  }
}

/** Convert validated model output into the editor's persisted numeric pose. */
export function poseIntentToState(draft: PoseIntentDraft): PoseState {
  if (draft.schema !== "clicktoon.pose-intent/v1")
    throw new Error("Unsupported pose intent schema");
  if (draft.figures.length < 1 || draft.figures.length > 3)
    throw new Error("A pose intent must contain between one and three figures");
  if (new Set(draft.figures.map((figure) => figure.id)).size !== draft.figures.length)
    throw new Error("Figure ids must be unique");
  validateInteractionIntent(draft);

  return {
    ...DEFAULT_POSE,
    figures: draft.figures.map((figure) => {
      if (!figure.id.trim()) throw new Error("Each figure needs a non-empty id");
      if (!isFiniteVec3(figure.placement.position))
        throw new Error(`Invalid placement.position for figure ${figure.id}`);
      if (
        !Number.isFinite(figure.placement.yawDegrees) ||
        (figure.placement.scale !== undefined && !Number.isFinite(figure.placement.scale))
      )
        throw new Error(`Invalid placement rotation or scale for figure ${figure.id}`);

      const bones: Record<string, [number, number, number]> = {};
      for (const [joint, vector] of Object.entries(figure.joints) as [
        PoseBoneId,
        AxisDegrees,
      ][]) {
        if (!POSE_LANGUAGE_DATA_MAP.joints[joint])
          throw new Error(`Unsupported joint: ${joint}`);
        if (!isFiniteVec3(vector)) throw new Error(`Invalid joint values for ${joint}`);
        bones[joint] = radiansForJoint(joint, vector);
      }
      return {
        id: figure.id,
        characterId: figure.characterId ?? null,
        bones,
        position: [
          figure.placement.position[0],
          clamp(figure.placement.position[1], FIGURE_Y_MIN, FIGURE_Y_MAX),
          figure.placement.position[2],
        ],
        rotationY: degToRad(normalizeDegrees(figure.placement.yawDegrees)),
        scale: clamp(figure.placement.scale ?? 1, FIGURE_SCALE_MIN, FIGURE_SCALE_MAX),
      };
    }),
  };
}

/** Relationship features derived from placements, for validation or LLM feedback. */
export function interactionMetrics(a: PoseIntentFigure, b: PoseIntentFigure) {
  const dx = b.placement.position[0] - a.placement.position[0];
  const dz = b.placement.position[2] - a.placement.position[2];
  const distanceXZ = Math.hypot(dx, dz);
  const directionFromA = distanceXZ ? [dx / distanceXZ, dz / distanceXZ] : [0, 0];
  const aFacing = [Math.sin(degToRad(a.placement.yawDegrees)), Math.cos(degToRad(a.placement.yawDegrees))];
  const bFacing = [Math.sin(degToRad(b.placement.yawDegrees)), Math.cos(degToRad(b.placement.yawDegrees))];
  return {
    distanceXZ,
    yawDifferenceDegrees: Math.abs(a.placement.yawDegrees - b.placement.yawDegrees),
    aFacesB: aFacing[0] * directionFromA[0] + aFacing[1] * directionFromA[1],
    bFacesA: -(bFacing[0] * directionFromA[0] + bFacing[1] * directionFromA[1]),
  };
}
