"use client";
import {
  DEFAULT_POSE,
  POSE_STORAGE_KEY,
  PoseState,
  parsePoseState,
} from "@/types/pose";

// 장면(피규어 전원 + 카메라/조명/출력)을 통째로 저장한다.
// 예전에는 캐릭터별 키(omc:pose:char:*)로도 저장해 캐릭터를 바꾸면 그 캐릭터의
// 포즈로 씬이 교체됐지만, 멀티 피규어에서는 장면이 특정 캐릭터에 종속되지
// 않으므로 씬 단위 단일 키로 통일했다.
export function savePose(pose: PoseState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(POSE_STORAGE_KEY, JSON.stringify(pose));
}

export function loadPose(): PoseState {
  if (typeof window === "undefined") return DEFAULT_POSE;
  const raw = window.localStorage.getItem(POSE_STORAGE_KEY);
  if (!raw) return DEFAULT_POSE;
  try {
    // 구 스키마(skinned-v2 — 평평한 bones/rootPosition)는 피규어 1체로 승격된다.
    return parsePoseState(JSON.parse(raw));
  } catch {
    return DEFAULT_POSE;
  }
}

export function clearPose() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(POSE_STORAGE_KEY);
}
