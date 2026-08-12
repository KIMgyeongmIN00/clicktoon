import { FigureLayout } from "@/types/pose";

// 캡처 시점 화면 좌표를 사람이 읽는 위치 서술로 바꾼다.
//
// 합성 렌더는 마네킹 여러 체가 한 장에 들어 있고, 이미지 API에는 "이 이미지의
// 이 부분이 저 캐릭터"라고 지정할 수단이 없다. 그래서 이 서술이 마네킹과
// 캐릭터를 잇는 유일한 단서다 — 반드시 서로 겹치지 않아야 한다.

const LEFT_EDGE = 0.33;
const RIGHT_EDGE = 0.67;
// 좌우가 이보다 가까우면 같은 구역으로 보고 카메라 거리로 갈라 준다.
const SAME_BAND = 0.15;

function horizontal(x: number): string {
  if (x < LEFT_EDGE) return "on the LEFT";
  if (x > RIGHT_EDGE) return "on the RIGHT";
  return "in the CENTER";
}

function ordinal(n: number): string {
  if (n === 1) return "1st";
  if (n === 2) return "2nd";
  if (n === 3) return "3rd";
  return `${n}th`;
}

/** layout과 같은 순서로 각 피규어의 위치 서술을 돌려준다. */
export function describeFigurePlacement(layout: FigureLayout[]): string[] {
  const base = layout.map((f, i) => {
    const where = horizontal(f.x);
    // 같은 좌우 구역에 다른 피규어가 있으면 앞/뒤로 보강한다.
    const rivals = layout.filter(
      (o, j) => j !== i && Math.abs(o.x - f.x) < SAME_BAND,
    );
    if (!rivals.length) return where;
    if (rivals.every((o) => f.depth < o.depth))
      return `${where}, nearer to the camera`;
    if (rivals.every((o) => f.depth > o.depth))
      return `${where}, farther from the camera`;
    return `${where}, at the middle depth`;
  });

  // 두 피규어가 완전히 겹쳐 서술이 같아지면 매핑이 무의미해진다. 그럴 때만
  // 화면 왼쪽부터 센 순번을 덧붙여 유일성을 보장한다.
  const duplicated = new Set(
    base.filter((d, i) => base.indexOf(d) !== i),
  );
  if (!duplicated.size) return base;

  const leftToRight = layout
    .map((f, i) => ({ i, x: f.x }))
    .sort((a, b) => a.x - b.x);
  const rank = new Map(leftToRight.map((e, n) => [e.i, n + 1]));

  return base.map((d, i) =>
    duplicated.has(d) ? `${d} (${ordinal(rank.get(i)!)} from the left)` : d,
  );
}
