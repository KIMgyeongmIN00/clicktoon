import { clampRotation } from "./limits";

const deg = (d: number) => (d * Math.PI) / 180;

export type PresetGroup =
  | "서기"
  | "앉기"
  | "이동"
  | "액션"
  | "제스처"
  | "일상";

export const PRESET_GROUPS: PresetGroup[] = [
  "서기",
  "앉기",
  "이동",
  "액션",
  "제스처",
  "일상",
];

export type Preset = {
  id: string;
  label: string;
  group: PresetGroup;
  bones: Record<string, [number, number, number]>;
  /**
   * 접지 높이(월드 단위, 키 1.7 기준). 피규어의 y 위치로 그대로 들어간다.
   *
   * 이 리그는 골반 높이가 고정이라 다리를 접어도 몸이 내려오지 않는다. 그래서
   * 앉기·무릎 꿇기처럼 몸이 낮아져야 하는 자세는 피규어 자체를 내려 줘야
   * 바닥에 앉은 것처럼 보인다. 값은 GLB의 관절 위치로 계산했다
   * (scripts/compute-ground.ts 참고).
   *
   * 공중에 떠야 하는 자세(점프)는 지정하지 않는다 — 자동 접지를 쓰지 않는 이유.
   */
  groundY?: number;
};

type V3 = [number, number, number];

// ── Bony 리그의 실제 거동 (bony.glb 실측 + 브라우저 육안 검증) ──
//
// ⚠️ 축을 raw로 쓰면 반드시 틀린다. 아래 헬퍼로만 작성할 것.
//
// 1. 기본 자세는 **T-포즈**다. 팔이 옆으로 뻗어 있으므로 대부분의 자세는
//    먼저 팔을 내려야(up ≈ −78°) 자연스러워진다.
//
// 2. 어깨·팔꿈치·골반은 **좌우가 월드에서 똑같이 움직인다** — 미러링이 없다.
//    좌우에 반대 부호를 주면 한쪽만 올라가는 비대칭이 된다.
//
// 3. 상체는 **use-mannequin.ts가 척추를 이어 준 뒤에야** 굽혀진다.
//    GLB에서는 ROOTJ·spine01~03J·Spine04J·Neck02J·HeadJ가 전부 형제로 평평하게
//    놓여 있어 허리를 돌려도 위쪽이 따라오지 않았다. 팔다리 CurveJ와 같은
//    문제였고 같은 방식(attach 재부모화)으로 고쳤다. attach는 월드 변환을
//    보존하므로 축 의미는 그대로다.
//    가동범위상 허리 30° + 가슴 25° = 약 55°까지 숙일 수 있다.
//
// 4. **팔꿈치의 굽힘 축은 어깨 각도에 따라 달라진다.** T-포즈(팔 수평)에서는
//    로컬 y가 굽힘이지만, 팔을 완전히 내리면 로컬 x가 굽힘이 된다. 그래서
//    어깨와 팔꿈치를 따로 쓰지 않고 arm()으로 함께 지정한다 — up 값에 맞춰
//    두 축을 섞어 항상 자연스러운 굽힘이 나오게 한다.
//
//  실측 축:
//    shoulder  z+ 위 · y+ 뒤
//    elbow     (T-포즈 기준) y+ 뒤 · z+ 바깥 · (팔 내린 기준) x+ 앞으로 굽힘
//    hip       z+ 앞 · x+ 바깥(좌우 자동 대칭)
//    knee      z+ 앞  → 굽힘은 z−
//    ankle     z+ 발끝 들기
//    spine     x+ 앞으로 숙임 · y+ 화면오른쪽 비틀기 · z+ 화면왼쪽 기울임
//    chest     x+ 화면오른쪽 비틀기 · y+ 화면오른쪽 기울임 · z+ 뒤로 젖힘
//    neck/head x+ 화면오른쪽 돌림 · y+ 화면오른쪽 기울임 · z+ 고개 들기
//
// 값의 의미는 전부 **화면 기준**으로 통일한다(캐릭터 좌/우는 헷갈린다).
// 캐릭터는 +Z(카메라)를 보고 서며, 화면 오른쪽이 월드 +X다.
// 인자는 전부 **도(degree)** 단위.

/**
 * 팔 한쪽(어깨 + 팔꿈치)을 함께 지정한다.
 *   up   : +위 / −아래 (T-포즈가 0, 완전히 내리면 −90)
 *   fwd  : +앞으로 / −뒤로
 *   bend : +팔꿈치를 앞으로 굽힘
 * 굽힘 축은 up에 맞춰 자동 보정된다(위 4번 참고).
 */
export function arm(side: "l" | "r", up: number, fwd = 0, bend = 0) {
  const t = deg(up);
  return {
    [`shoulder_${side}`]: [0, deg(-fwd), deg(up)] as V3,
    [`elbow_${side}`]: [
      deg(-Math.sin(t) * bend),
      deg(-Math.cos(t) * bend),
      0,
    ] as V3,
  };
}

/** 양팔을 대칭으로. */
export const arms = (up: number, fwd = 0, bend = 0) => ({
  ...arm("l", up, fwd, bend),
  ...arm("r", up, fwd, bend),
});

/** 골반. fwd: +다리 앞으로 · out: +바깥으로 벌리기(좌우 자동 대칭) */
export const hip = (fwd: number, out = 0): V3 => [deg(out), 0, deg(fwd)];
/** 무릎. bend: +굽힘(뒤꿈치가 엉덩이 쪽으로) */
export const kn = (bend: number): V3 => [0, 0, deg(-bend)];
/** 발목. flex: +발끝 들기 / −발끝 내리기 */
export const ank = (flex: number): V3 => [0, 0, deg(flex)];
/** 허리. bend:+앞으로 숙임 · turn:+화면오른쪽 비틀기 · tilt:+화면오른쪽 기울임 */
export const spn = (bend = 0, turn = 0, tilt = 0): V3 => [
  deg(bend),
  deg(turn),
  deg(-tilt),
];
/** 가슴. 인자 의미는 허리와 같으나 축 배정이 다르다. */
export const cst = (bend = 0, turn = 0, tilt = 0): V3 => [
  deg(turn),
  deg(tilt),
  deg(-bend),
];
/** 목·머리. nod:+숙임 · turn:+화면오른쪽 · tilt:+화면오른쪽 기울임 */
export const nk = (nod = 0, turn = 0, tilt = 0): V3 => [
  deg(turn),
  deg(tilt),
  deg(-nod),
];

// 가동범위(적용 시 clampRotation으로 잘림): 팔다리 ±120°, 목·머리 x±35 y±45 z±30.
// 이 파일의 값은 전부 한계 안이며, 검증 스크립트로 확인한다.
export const PRESETS: Preset[] = [
  // ───────────────────────── 서기 ─────────────────────────
  { id: "tpose", label: "T 포즈", group: "서기", bones: {} },
  {
    id: "base",
    label: "기본 서기",
    group: "서기",
    bones: { ...arms(-78, 0, 10) },
  },
  {
    id: "attention",
    label: "차렷",
    group: "서기",
    bones: { ...arms(-86, 0, 4) },
  },
  {
    id: "relaxed",
    label: "편하게 서기",
    group: "서기",
    bones: { ...arms(-72, -4, 20), head: nk(0, -8) },
  },
  {
    id: "contrapposto",
    label: "짝다리",
    group: "서기",
    bones: {
      ...arm("l", -70, 0, 24),
      ...arm("r", -76, 0, 14),
      hip_l: hip(-4, 7), knee_l: kn(14),
      hip_r: hip(2, 2),
      head: nk(0, 10, -6),
    },
  },
  {
    id: "arms_crossed",
    label: "팔짱",
    group: "서기",
    bones: { ...arms(-52, 26, 104), head: nk(4, -6) },
  },
  {
    id: "hands_hips",
    label: "허리에 손",
    group: "서기",
    bones: {
      ...arms(-58, -14, 98),
      hip_l: hip(0, 7), hip_r: hip(0, 7),
    },
  },
  {
    id: "hands_behind",
    label: "뒷짐",
    group: "서기",
    bones: { ...arms(-70, -34, 64), head: nk(-4) },
  },
  {
    id: "open_arms",
    label: "팔 벌리기",
    group: "서기",
    bones: { ...arms(6, 26, 12), chest: cst(-8), head: nk(-6) },
  },
  {
    id: "lean_back",
    label: "젖히기",
    group: "서기",
    bones: {
      ...arms(-62, -18, 24),
      spine: spn(-24),
      chest: cst(-20),
      neck: nk(-18),
      head: nk(-16),
      hip_l: hip(-10), hip_r: hip(-10),
    },
  },

  // ───────────────────────── 앉기 ─────────────────────────
  {
    id: "sit",
    label: "의자에 앉기",
    group: "앉기",
    groundY: -0.38,
    bones: {
      hip_l: hip(95, 8), hip_r: hip(95, 8),
      knee_l: kn(100), knee_r: kn(100),
      ...arms(-70, 12, 38),
    },
  },
  {
    id: "sit_relaxed",
    label: "기대어 앉기",
    group: "앉기",
    groundY: -0.31,
    bones: {
      spine: spn(-14),
      chest: cst(-10),
      hip_l: hip(84, 16), hip_r: hip(84, 16),
      knee_l: kn(84), knee_r: kn(94),
      ...arms(-62, -14, 48),
      head: nk(-6, -8),
    },
  },
  {
    id: "sit_floor",
    label: "양반다리",
    group: "앉기",
    groundY: -0.33,
    bones: {
      hip_l: hip(68, 56), hip_r: hip(68, 56),
      knee_l: kn(112), knee_r: kn(112),
      ...arms(-64, 16, 52),
    },
  },
  {
    id: "kneel",
    label: "무릎 꿇기",
    group: "앉기",
    groundY: -0.44,
    bones: {
      hip_l: hip(14, 5), hip_r: hip(14, 5),
      knee_l: kn(116), knee_r: kn(116),
      ankle_l: ank(-38), ankle_r: ank(-38),
      ...arms(-74, 8, 22),
    },
  },
  {
    id: "kneel_one",
    label: "한쪽 무릎",
    group: "앉기",
    groundY: -0.35,
    bones: {
      hip_l: hip(90, 10), knee_l: kn(90),
      hip_r: hip(12, 4), knee_r: kn(114), ankle_r: ank(-36),
      ...arm("l", -64, 18, 50),
      ...arm("r", -72, 8, 26),
      head: nk(-6),
    },
  },
  {
    id: "squat",
    label: "쪼그려 앉기",
    group: "앉기",
    groundY: -0.46,
    bones: {
      spine: spn(22),
      chest: cst(10),
      hip_l: hip(108, 20), hip_r: hip(108, 20),
      knee_l: kn(116), knee_r: kn(116),
      ankle_l: ank(26), ankle_r: ank(26),
      ...arms(-52, 34, 68),
      head: nk(10),
    },
  },

  // ───────────────────────── 이동 ─────────────────────────
  // 팔은 다리와 반대로 흔든다(왼다리 앞 → 오른팔 앞).
  {
    id: "walk",
    label: "걷기",
    group: "이동",
    bones: {
      hip_l: hip(26, 3), knee_l: kn(14), ankle_l: ank(8),
      hip_r: hip(-20, 3), knee_r: kn(30), ankle_r: ank(-12),
      ...arm("l", -74, -20, 24),
      ...arm("r", -74, 22, 24),
    },
  },
  {
    id: "run",
    label: "달리기",
    group: "이동",
    bones: {
      spine: spn(16, -8),
      chest: cst(6, 10),
      hip_l: hip(56, 4), knee_l: kn(76), ankle_l: ank(12),
      hip_r: hip(-36, 4), knee_r: kn(46), ankle_r: ank(-22),
      ...arm("l", -66, -46, 82),
      ...arm("r", -66, 48, 86),
      head: nk(-10),
    },
  },
  {
    id: "sprint",
    label: "전력질주",
    group: "이동",
    bones: {
      spine: spn(28, -10),
      chest: cst(14, 12),
      hip_l: hip(82, 4), knee_l: kn(94), ankle_l: ank(16),
      hip_r: hip(-50, 4), knee_r: kn(62), ankle_r: ank(-32),
      ...arm("l", -58, -62, 96),
      ...arm("r", -58, 66, 100),
      neck: nk(-20), head: nk(-18),
    },
  },
  {
    id: "jump",
    label: "점프",
    group: "이동",
    bones: {
      ...arms(88, 10, 16),
      hip_l: hip(44, 12), knee_l: kn(70),
      hip_r: hip(32, 12), knee_r: kn(56),
      ankle_l: ank(-24), ankle_r: ank(-24),
      head: nk(-14),
    },
  },
  {
    id: "land",
    label: "착지",
    group: "이동",
    groundY: -0.2,
    bones: {
      spine: spn(26, 10),
      chest: cst(14, 8),
      hip_l: hip(94, 24), knee_l: kn(106), ankle_l: ank(22),
      hip_r: hip(58, 18), knee_r: kn(82), ankle_r: ank(16),
      ...arm("l", -46, 62, 28),
      ...arm("r", -88, -30, 44),
      head: nk(10, -12),
    },
  },
  {
    id: "climb",
    label: "기어오르기",
    group: "이동",
    bones: {
      spine: spn(12, 12),
      chest: cst(8, 10),
      ...arm("l", 96, 14, 22),
      ...arm("r", 40, 30, 76),
      hip_l: hip(72, 26), knee_l: kn(86),
      hip_r: hip(12, 8), knee_r: kn(32),
      head: nk(-16),
    },
  },

  // ───────────────────────── 액션 ─────────────────────────
  {
    id: "action",
    label: "액션",
    group: "액션",
    groundY: -0.13,
    bones: {
      spine: spn(10, 15),
      chest: cst(0, 12),
      ...arm("l", 78, -16, 78),
      ...arm("r", -72, -34, 30),
      hip_l: hip(-24, 5), knee_l: kn(20),
      hip_r: hip(34, 5), knee_r: kn(68),
      head: nk(0, -15),
    },
  },
  {
    id: "dynamic",
    label: "다이나믹",
    group: "액션",
    groundY: -0.2,
    bones: {
      spine: spn(-12, -20, -8),
      chest: cst(-8, -12),
      ...arm("l", 102, 18, 48),
      ...arm("r", -84, -48, 68),
      hip_l: hip(58, 10), knee_l: kn(88),
      hip_r: hip(-28, 8), knee_r: kn(24),
      neck: nk(-10, 15), head: nk(-8, 20),
    },
  },
  {
    id: "punch",
    label: "펀치",
    group: "액션",
    groundY: -0.05,
    bones: {
      spine: spn(0, -26),
      chest: cst(6, -22),
      ...arm("r", -14, 88, 6),
      ...arm("l", -56, -22, 96),
      hip_l: hip(-18, 8), knee_l: kn(22),
      hip_r: hip(24, 10), knee_r: kn(40),
      head: nk(0, -10),
    },
  },
  {
    id: "kick",
    label: "하이킥",
    group: "액션",
    groundY: -0.06,
    bones: {
      spine: spn(-16, 12),
      chest: cst(-12, 10),
      hip_r: hip(110, 14), knee_r: kn(12), ankle_r: ank(-18),
      hip_l: hip(-12, 6), knee_l: kn(16),
      ...arm("l", -30, 52, 44),
      ...arm("r", -46, -38, 36),
      head: nk(-8, 8),
    },
  },
  {
    id: "guard",
    label: "가드",
    group: "액션",
    groundY: -0.06,
    bones: {
      spine: spn(10, 14),
      chest: cst(8, 12),
      ...arm("l", -34, 44, 110),
      ...arm("r", -30, 50, 114),
      hip_l: hip(-16, 10), knee_l: kn(30),
      hip_r: hip(18, 12), knee_r: kn(42),
      head: nk(-6, -12),
    },
  },
  {
    id: "sword",
    label: "검 내려베기",
    group: "액션",
    groundY: -0.07,
    bones: {
      spine: spn(10, 14),
      chest: cst(8, 12),
      ...arms(78, 28, 56),
      hip_l: hip(28, 14), knee_l: kn(46),
      hip_r: hip(-24, 10), knee_r: kn(18),
      head: nk(-8, 6),
    },
  },
  {
    id: "bow_shoot",
    label: "활 쏘기",
    group: "액션",
    bones: {
      spine: spn(0, 24),
      chest: cst(0, 20),
      ...arm("l", -6, 84, 6),
      ...arm("r", -16, 26, 104),
      hip_l: hip(-10, 16), hip_r: hip(6, 16), knee_r: kn(16),
      head: nk(0, 34),
    },
  },
  {
    id: "dodge",
    label: "회피",
    group: "액션",
    groundY: -0.1,
    bones: {
      spine: spn(-26, -18, -14),
      chest: cst(-20, -14, -10),
      ...arm("l", -40, -34, 56),
      ...arm("r", -34, -50, 62),
      hip_l: hip(-22, 18), knee_l: kn(34),
      hip_r: hip(16, 22), knee_r: kn(52),
      neck: nk(-14, -14), head: nk(-12, -18, -10),
    },
  },

  // ───────────────────────── 제스처 ─────────────────────────
  {
    id: "wave",
    label: "손 흔들기",
    group: "제스처",
    bones: {
      ...arm("r", 52, 12, 58),
      ...arm("l", -78, 0, 12),
      head: nk(-6, 8, 6),
    },
  },
  {
    id: "cheer",
    label: "만세",
    group: "제스처",
    bones: { ...arms(86, 6, 12), neck: nk(-14), head: nk(-16) },
  },
  {
    id: "think",
    label: "생각하기",
    group: "제스처",
    bones: {
      ...arm("r", -38, 44, 112),
      ...arm("l", -58, 22, 76),
      neck: nk(10, -10), head: nk(12, -12, -8),
    },
  },
  {
    id: "point",
    label: "가리키기",
    group: "제스처",
    bones: {
      ...arm("r", -8, 84, 8),
      ...arm("l", -76, 0, 16),
      finger1_r1: [deg(-10), 0, 0],
      finger2_r1: [deg(74), 0, 0],
      finger2_r2: [deg(66), 0, 0],
      head: nk(0, -8),
    },
  },
  {
    id: "bow_greet",
    label: "인사",
    group: "제스처",
    bones: {
      ...arms(-68, 20, 40),
      spine: spn(30),
      chest: cst(24),
      neck: nk(18),
      head: nk(16),
      hip_l: hip(-6, 4), hip_r: hip(-6, 4),
    },
  },
  {
    id: "clap",
    label: "박수",
    group: "제스처",
    bones: { ...arms(-40, 46, 90), head: nk(-6) },
  },
  {
    id: "salute",
    label: "경례",
    group: "제스처",
    bones: {
      ...arm("r", 18, 40, 110),
      ...arm("l", -86, 0, 4),
      head: nk(-6),
    },
  },
  {
    id: "shrug",
    label: "어깨 으쓱",
    group: "제스처",
    bones: {
      ...arms(-56, 8, 82),
      wrist_l: [0, 0, deg(-22)], wrist_r: [0, 0, deg(-22)],
      neck: nk(10), head: nk(8, 0, 8),
    },
  },

  // ───────────────────────── 일상 ─────────────────────────
  {
    id: "stretch",
    label: "기지개",
    group: "일상",
    bones: {
      spine: spn(-24),
      chest: cst(-20),
      ...arms(92, 10, 24),
      neck: nk(-22), head: nk(-20),
      hip_l: hip(-8, 6), hip_r: hip(-8, 6),
    },
  },
  {
    id: "selfie",
    label: "셀카",
    group: "일상",
    bones: {
      ...arm("r", 26, 62, 52),
      ...arm("l", -58, 26, 60),
      neck: nk(-8, -8), head: nk(-10, -10, -12),
    },
  },
  {
    id: "read",
    label: "독서",
    group: "일상",
    bones: {
      spine: spn(12),
      chest: cst(10),
      ...arms(-30, 58, 84),
      neck: nk(26), head: nk(24),
    },
  },
  {
    id: "phone",
    label: "휴대폰 보기",
    group: "일상",
    bones: {
      spine: spn(10),
      chest: cst(8),
      ...arm("l", -34, 54, 96),
      ...arm("r", -50, 42, 74),
      neck: nk(28), head: nk(26, -6),
    },
  },
  {
    id: "lean_side",
    label: "기대기",
    group: "일상",
    bones: {
      ...arm("l", -88, -26, 22),
      ...arm("r", -70, 6, 26),
      hip_l: hip(-4, 10), hip_r: hip(-8, 4), knee_r: kn(18),
      head: nk(0, 14, -10),
    },
  },
];
// 프리셋 값을 인체 가동범위로 자른다. 프리셋은 완결된 자세를 정의하므로
// 항상 빈 상태에서 시작한다(이전 자세의 잔여 회전이 섞이면 안 된다).
export function clampBones(
  bones: Record<string, [number, number, number]>,
): Record<string, [number, number, number]> {
  const next: Record<string, [number, number, number]> = {};
  for (const [bone, rot] of Object.entries(bones)) {
    next[bone] = clampRotation(bone, rot);
  }
  return next;
}

export function applyPreset(
  _current: Record<string, [number, number, number]>,
  preset: Preset,
): Record<string, [number, number, number]> {
  return clampBones(preset.bones);
}

export function presetsByGroup(): Record<PresetGroup, Preset[]> {
  const out = {} as Record<PresetGroup, Preset[]>;
  for (const g of PRESET_GROUPS) out[g] = [];
  for (const p of PRESETS) out[p.group].push(p);
  return out;
}
