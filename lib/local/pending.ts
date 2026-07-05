"use client";
import { PoseState } from "@/types/pose";
import { Provider } from "@/lib/providers/types";

// 미로그인 상태에서 "이미지 생성"을 누른 시점의 스냅샷. 가입/로그인 후 홈으로
// 복귀하면 이 스냅샷으로 자동 생성을 이어간다. (포즈는 setPose로 복원 후 재캡처)

const KEY = "omc:pending-generation";

export type PendingGeneration = {
  characterId: string; // local:* 또는 서버 uuid
  provider: Provider;
  extraPrompt: string;
  pose: PoseState;
  createdAt: number;
};

export function savePendingGeneration(
  p: Omit<PendingGeneration, "createdAt">,
): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...p, createdAt: Date.now() }));
  } catch {
    /* 용량 초과 등 — 자동 재개만 포기 */
  }
}

// 읽으면서 제거(1회성). 30분 지난 스냅샷은 무시.
export function takePendingGeneration(): PendingGeneration | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    localStorage.removeItem(KEY);
    const p = JSON.parse(raw) as PendingGeneration;
    if (Date.now() - p.createdAt > 30 * 60 * 1000) return null;
    return p;
  } catch {
    return null;
  }
}
