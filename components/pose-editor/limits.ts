// Per-bone rotation DELTA limits (radians), relative to each joint's rest pose.
// The Bony rig's joint axis orientations vary, so first-pass limits are kept
// generous on all axes; tighten/lock per joint after visual calibration.

import { CONTROL_BONES } from "./bones";

const deg = (d: number) => (d * Math.PI) / 180;

export type AxisRange = { min: number; max: number };
export type BoneLimits = { x: AxisRange; y: AxisRange; z: AxisRange };

function sym(d: number): AxisRange {
  return { min: deg(-d), max: deg(d) };
}

// Tuned ranges where we have a reasonable expectation; everything else gets a
// generous default so the natural bend axis is always reachable.
const SPECIFIC: Record<string, BoneLimits> = {
  root: { x: sym(30), y: sym(60), z: sym(30) },
  spine: { x: sym(30), y: sym(30), z: sym(30) },
  chest: { x: sym(25), y: sym(25), z: sym(25) },
  neck: { x: sym(35), y: sym(45), z: sym(30) },
  head: { x: sym(35), y: sym(45), z: sym(30) },
};

const DEFAULT_LIMB: BoneLimits = { x: sym(120), y: sym(120), z: sym(120) };
const DEFAULT_FINGER: BoneLimits = { x: sym(100), y: sym(100), z: sym(100) };

export const LIMITS: Record<string, BoneLimits> = (() => {
  const out: Record<string, BoneLimits> = {};
  for (const b of CONTROL_BONES) {
    if (SPECIFIC[b.name]) out[b.name] = SPECIFIC[b.name];
    else if (b.group === "왼손" || b.group === "오른손")
      out[b.name] = DEFAULT_FINGER;
    else out[b.name] = DEFAULT_LIMB;
  }
  return out;
})();

export function clamp(v: number, min: number, max: number) {
  if (min === max) return min;
  return Math.min(max, Math.max(min, v));
}

export function clampRotation(
  bone: string,
  rot: [number, number, number],
): [number, number, number] {
  const l = LIMITS[bone];
  if (!l) return rot;
  return [
    clamp(rot[0], l.x.min, l.x.max),
    clamp(rot[1], l.y.min, l.y.max),
    clamp(rot[2], l.z.min, l.z.max),
  ];
}

export function axisLocked(range: AxisRange): boolean {
  return range.min === range.max;
}
