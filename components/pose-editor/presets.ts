import { clampRotation } from "./limits";

const deg = (d: number) => (d * Math.PI) / 180;

export type Preset = {
  id: string;
  label: string;
  bones: Record<string, [number, number, number]>;
};

// Quick one-shot poses. All values are clamped to LIMITS before being applied.
// `replace: true` resets to an exact pose (clears other bones first).
export const PRESETS: Preset[] = [
  {
    id: "base",
    label: "기본 자세",
    bones: {},
  },
  {
    id: "sit",
    label: "앉기",
    bones: {
      hip_l: [deg(100), 0, deg(8)],
      hip_r: [deg(100), 0, deg(-8)],
      knee_l: [deg(-120), 0, 0],
      knee_r: [deg(-120), 0, 0],
      spine: [deg(8), 0, 0],
      shoulder_l: [deg(15), 0, deg(5)],
      shoulder_r: [deg(15), 0, deg(-5)],
      elbow_l: [deg(40), 0, 0],
      elbow_r: [deg(40), 0, 0],
    },
  },
  {
    id: "action",
    label: "액션",
    bones: {
      shoulder_l: [deg(120), 0, deg(-10)],
      elbow_l: [deg(80), 0, 0],
      shoulder_r: [deg(-40), 0, deg(20)],
      elbow_r: [deg(30), 0, 0],
      hip_l: [deg(-25), 0, deg(5)],
      knee_l: [deg(-20), 0, 0],
      hip_r: [deg(35), 0, deg(-5)],
      knee_r: [deg(-70), 0, 0],
      spine: [deg(10), deg(15), 0],
      chest: [0, deg(12), 0],
      head: [0, deg(-15), 0],
    },
  },
  {
    id: "dynamic",
    label: "다이나믹",
    bones: {
      shoulder_l: [deg(160), 0, deg(-15)],
      elbow_l: [deg(50), 0, 0],
      shoulder_r: [deg(-55), 0, deg(25)],
      elbow_r: [deg(70), 0, 0],
      hip_l: [deg(60), 0, deg(10)],
      knee_l: [deg(-90), 0, 0],
      hip_r: [deg(-30), 0, deg(-8)],
      knee_r: [deg(-25), 0, 0],
      spine: [deg(-12), deg(-20), deg(8)],
      chest: [deg(-8), deg(-12), 0],
      neck: [deg(10), deg(15), 0],
      head: [deg(8), deg(20), 0],
    },
  },
];

export function applyPreset(
  current: Record<string, [number, number, number]>,
  preset: Preset,
): Record<string, [number, number, number]> {
  // Presets define a complete pose, so start from a clean slate.
  const next: Record<string, [number, number, number]> = {};
  for (const [bone, rot] of Object.entries(preset.bones)) {
    next[bone] = clampRotation(bone, rot);
  }
  return next;
}
