"use client";
import { PoseState } from "@/types/pose";
import { Provider } from "@/lib/providers/types";

// 미로그인 상태에서 "이미지 생성"을 누른 시점의 스냅샷. 가입/로그인 후 홈으로
// 복귀하면 이 스냅샷으로 자동 생성을 이어간다. (포즈는 setPose로 복원 후 재캡처)
//
// 등장인물은 pose.figures[].characterId에 들어 있다 — 별도 필드로 들고 있지 않다.

const KEY = "omc:pending-generation";

export type PendingGeneration = {
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

/**
 * 로컬 캐릭터 id(local:*)를 서버 uuid로 바꿔 끼운다.
 *
 * 가입 직후 로컬 캐릭터가 서버로 이관되면 id가 전부 바뀐다. 장면에 선 피규어
 * **전원**을 갈아 끼워야 한다 — 하나라도 local:* 로 남으면 그 캐릭터를 찾지
 * 못해 생성이 404로 실패한다.
 */
export function remapFigureCharacters(
  pose: PoseState,
  mapping: Map<string, string>,
): PoseState {
  return {
    ...pose,
    figures: pose.figures.map((f) => ({
      ...f,
      characterId: f.characterId
        ? (mapping.get(f.characterId) ?? f.characterId)
        : null,
    })),
  };
}
