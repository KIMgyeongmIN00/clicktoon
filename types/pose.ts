import { z } from "zod";

const triple = z.tuple([z.number(), z.number(), z.number()]);

export const POSE_MODEL_ID = "skinned-v2";

// Output canvas aspect ratios → pixel sizes for generation.
export const CANVAS_SIZES = {
  "1:1": { w: 1024, h: 1024, label: "정사각 1:1" },
  "3:4": { w: 864, h: 1152, label: "세로 3:4" },
  "4:3": { w: 1152, h: 864, label: "가로 4:3" },
  "9:16": { w: 768, h: 1344, label: "세로 9:16" },
  "16:9": { w: 1344, h: 768, label: "가로 16:9" },
} as const;

export type CanvasAspect = keyof typeof CANVAS_SIZES;

export const poseStateSchema = z.object({
  modelId: z.string().default(POSE_MODEL_ID),
  bones: z.record(z.string(), triple),
  rootPosition: triple.default([0, 0, 0]),
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
  aspect: z
    .enum(["1:1", "3:4", "4:3", "9:16", "16:9"])
    .default("3:4"),
});

export type PoseState = z.infer<typeof poseStateSchema>;

export const POSE_STORAGE_KEY = "omc:pose:last";
export const POSE_STORAGE_KEY_FOR = (characterId: string) =>
  `omc:pose:char:${characterId}`;

export const DEFAULT_POSE: PoseState = {
  modelId: POSE_MODEL_ID,
  bones: {},
  rootPosition: [0, 0, 0],
  light2d: { x: -0.5, y: 0.6, intensity: 1.6, color: "#ffffff" },
  camera: { position: [0, 1.4, 4], target: [0, 1, 0], fov: 50 },
  distortion: { type: "none", strength: 0.5 },
  renderMode: "color",
  aspect: "3:4",
};

export type DistortionType = PoseState["distortion"]["type"];
export type RenderMode = PoseState["renderMode"];

// Map the 2D light (canvas-relative) to a 3D position for scene preview only.
// The light sits in front of the figure, offset by the 2D coordinates.
export function light2dToScenePosition(light: {
  x: number;
  y: number;
}): [number, number, number] {
  return [light.x * 4, 1 + light.y * 3, 3.5];
}
