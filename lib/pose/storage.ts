"use client";
import {
  DEFAULT_POSE,
  POSE_MODEL_ID,
  POSE_STORAGE_KEY,
  POSE_STORAGE_KEY_FOR,
  PoseState,
  poseStateSchema,
} from "@/types/pose";

export function savePose(pose: PoseState, characterId?: string) {
  if (typeof window === "undefined") return;
  const json = JSON.stringify(pose);
  window.localStorage.setItem(POSE_STORAGE_KEY, json);
  if (characterId) {
    window.localStorage.setItem(POSE_STORAGE_KEY_FOR(characterId), json);
  }
}

export function loadPose(characterId?: string): PoseState {
  if (typeof window === "undefined") return DEFAULT_POSE;
  const keys = [
    characterId ? POSE_STORAGE_KEY_FOR(characterId) : null,
    POSE_STORAGE_KEY,
  ].filter(Boolean) as string[];
  for (const key of keys) {
    const raw = window.localStorage.getItem(key);
    if (!raw) continue;
    try {
      const parsed = poseStateSchema.parse(JSON.parse(raw));
      // Migrate old pose data when the model/schema changes — keep bone pose.
      if (parsed.modelId !== POSE_MODEL_ID) {
        return { ...DEFAULT_POSE, bones: parsed.bones };
      }
      return parsed;
    } catch {
      // ignore malformed entry, fall through
    }
  }
  return DEFAULT_POSE;
}

export function clearPose(characterId?: string) {
  if (typeof window === "undefined") return;
  if (characterId)
    window.localStorage.removeItem(POSE_STORAGE_KEY_FOR(characterId));
  window.localStorage.removeItem(POSE_STORAGE_KEY);
}
