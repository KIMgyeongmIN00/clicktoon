import { FigureLayout, PoseState } from "@/types/pose";
import { describeFigurePlacement } from "@/lib/providers/figure-layout";
import type { PromptFigure } from "@/lib/providers/prompt";

// 장면(pose.figures)에서 생성 요청에 필요한 두 가지를 뽑아낸다:
//   1. [IMAGE 1..N] 순서의 캐릭터 id 목록
//   2. "이 마네킹은 몇 번 캐릭터이고 화면 어디에 있는지" 매핑
// 클라이언트(/api/generate)와 워커(trigger/run) 양쪽이 같은 규칙을 써야 하므로
// 여기 한곳에 모아 둔다.

/**
 * [IMAGE 1..N] 순서의 캐릭터 id. 같은 캐릭터가 두 마네킹을 연기할 수 있으므로
 * 순서를 지키며 중복을 제거한다 — 같은 레퍼런스를 두 번 보낼 이유가 없다.
 */
export function characterIdsFromPose(pose: PoseState): string[] {
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const f of pose.figures) {
    if (!f.characterId || seen.has(f.characterId)) continue;
    seen.add(f.characterId);
    ids.push(f.characterId);
  }
  return ids;
}

/** 캐릭터가 배정되지 않은 피규어의 id. 있으면 생성을 진행하면 안 된다. */
export function unassignedFigureIds(pose: PoseState): string[] {
  return pose.figures.filter((f) => !f.characterId).map((f) => f.id);
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

/**
 * 마네킹 ↔ 캐릭터 매핑 + 화면 위치 서술.
 *
 * layout은 캡처 시점 실제 카메라로 잰 값이라 정확하다. 없을 때(구 generations
 * 행, 캡처 실패)는 월드 X/Z로 근사한다 — 기본 카메라(+Z에서 원점을 봄) 기준
 * 좌우/원근과 일치하므로 대체값으로 충분하다.
 */
export function buildPromptFigures(
  pose: PoseState,
  characterIds: string[],
  layout: FigureLayout[] | null,
): PromptFigure[] {
  const placed = pose.figures.filter((f) => f.characterId);
  const byId = new Map((layout ?? []).map((l) => [l.figureId, l]));

  const effective: FigureLayout[] = placed.map((f) => {
    const measured = byId.get(f.id);
    if (measured) return measured;
    return {
      figureId: f.id,
      x: clamp01(0.5 + f.position[0] / 4),
      y: 0.5,
      depth: 4 - f.position[2],
    };
  });

  const descriptors = describeFigurePlacement(effective);

  return placed.map((f, i) => ({
    characterIndex: characterIds.indexOf(f.characterId!),
    descriptor: descriptors[i],
  }));
}
