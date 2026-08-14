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
};

type V3 = [number, number, number];

// ── Bony 리그의 실제 회전축 (bony.glb의 rest 월드 방향에서 실측) ──
//
// ⚠️ 직관과 다르다. 축을 raw로 쓰면 반드시 틀린다. 아래 헬퍼로만 작성할 것.
//
//  · 기본 자세는 **T-포즈**다. 팔이 옆으로 뻗어 있으므로, 대부분의 자세는
//    먼저 팔을 내려야(up ≈ −78°) 자연스러워진다.
//  · 어깨/팔꿈치/골반은 **좌우가 월드에서 똑같이 움직인다** — 미러링이 없다.
//    좌우에 반대 부호를 주면 한쪽만 올라가는 비대칭이 된다.
//  · 관절마다 축 배정이 다르다(허리는 월드 정렬, 가슴·목은 x=비틀기/z=앞뒤).
//
//  실측값:
//    shoulder  z+ 위 · y+ 뒤        (x는 z와 겹치고 트위스트가 섞여 쓰지 않음)
//    elbow     y+ 뒤 · z+ 위
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
/** 어깨. up: +위/−아래(T포즈가 0) · fwd: +앞으로/−뒤로 */
export const sh = (up: number, fwd = 0): V3 => [0, deg(-fwd), deg(up)];
/** 팔꿈치. bend: +앞으로 굽힘 · up: +위로 */
export const el = (bend: number, up = 0): V3 => [0, deg(-bend), deg(up)];
/** 골반. fwd: +다리 앞으로 · out: +바깥으로 벌리기(좌우 자동 대칭) */
export const hip = (fwd: number, out = 0): V3 => [deg(out), 0, deg(fwd)];
/** 무릎. bend: +굽힘(뒤꿈치가 엉덩이 쪽으로) */
export const kn = (bend: number): V3 => [0, 0, deg(-bend)];
/** 발목. flex: +발끝 들기 / −발끝 내리기 */
export const ank = (flex: number): V3 => [0, 0, deg(flex)];
/** 허리. bend:+앞으로 숙임 · turn:+화면오른쪽 비틀기 · tilt:+화면오른쪽 기울임 */
export const spn = (bend = 0, turn = 0, tilt = 0): V3 => [deg(bend), deg(turn), deg(-tilt)];
/** 가슴. 인자 의미는 허리와 같으나 축 배정이 다르다 */
export const cst = (bend = 0, turn = 0, tilt = 0): V3 => [deg(turn), deg(tilt), deg(-bend)];
/** 목·머리. nod:+숙임 · turn:+화면오른쪽 · tilt:+화면오른쪽 기울임 */
export const nk = (nod = 0, turn = 0, tilt = 0): V3 => [deg(turn), deg(tilt), deg(-nod)];

// 가동범위(적용 시 clampRotation으로 잘림): 팔다리 ±120°,
// 허리 ±30°, 가슴 ±25°, 목·머리 x±35 y±45 z±30.
// 이 파일의 값은 전부 한계 안이며, 검증 스크립트로 확인한다.
export const PRESETS: Preset[] = [
  // ───────────────────────── 서기 ─────────────────────────
  // T-포즈가 rest이므로 "팔을 내린" 상태가 대부분의 출발점이다.
  { id: "tpose", label: "T 포즈", group: "서기", bones: {} },
  {
    id: "base",
    label: "기본 서기",
    group: "서기",
    bones: {
      shoulder_l: sh(-78), shoulder_r: sh(-78),
      elbow_l: el(10), elbow_r: el(10),
    },
  },
  {
    id: "attention",
    label: "차렷",
    group: "서기",
    bones: {
      shoulder_l: sh(-86), shoulder_r: sh(-86),
      elbow_l: el(3), elbow_r: el(3),
      chest: cst(-4),
    },
  },
  {
    id: "relaxed",
    label: "편하게 서기",
    group: "서기",
    bones: {
      shoulder_l: sh(-72, -4), shoulder_r: sh(-72, -4),
      elbow_l: el(20), elbow_r: el(20),
      spine: spn(3, 0, 3),
      head: nk(0, -8),
    },
  },
  {
    id: "contrapposto",
    label: "짝다리",
    group: "서기",
    bones: {
      shoulder_l: sh(-70), shoulder_r: sh(-76),
      elbow_l: el(24), elbow_r: el(14),
      root: [0, 0, deg(9)],
      spine: spn(0, 0, -7),
      chest: cst(0, 0, -4),
      hip_l: hip(-4, 7), knee_l: kn(14),
      hip_r: hip(2, 2),
      head: nk(0, 10, -6),
    },
  },
  {
    id: "arms_crossed",
    label: "팔짱",
    group: "서기",
    bones: {
      shoulder_l: sh(-52, 26), shoulder_r: sh(-52, 26),
      elbow_l: el(104), elbow_r: el(104),
      chest: cst(5),
      head: nk(4, -6),
    },
  },
  {
    id: "hands_hips",
    label: "허리에 손",
    group: "서기",
    bones: {
      shoulder_l: sh(-58, -14), shoulder_r: sh(-58, -14),
      elbow_l: el(98), elbow_r: el(98),
      chest: cst(-5),
      hip_l: hip(0, 7), hip_r: hip(0, 7),
    },
  },
  {
    id: "hands_behind",
    label: "뒷짐",
    group: "서기",
    bones: {
      shoulder_l: sh(-70, -34), shoulder_r: sh(-70, -34),
      elbow_l: el(64), elbow_r: el(64),
      chest: cst(-8),
      head: nk(-4),
    },
  },
  {
    id: "lean_back",
    label: "젖히기",
    group: "서기",
    bones: {
      shoulder_l: sh(-62, -18), shoulder_r: sh(-62, -18),
      elbow_l: el(24), elbow_r: el(24),
      spine: spn(-22),
      chest: cst(-18),
      neck: nk(-20),
      head: nk(-16),
      hip_l: hip(-10), hip_r: hip(-10),
    },
  },

  // ───────────────────────── 앉기 ─────────────────────────
  {
    id: "sit",
    label: "의자에 앉기",
    group: "앉기",
    bones: {
      hip_l: hip(95, 8), hip_r: hip(95, 8),
      knee_l: kn(100), knee_r: kn(100),
      spine: spn(8),
      shoulder_l: sh(-70, 12), shoulder_r: sh(-70, 12),
      elbow_l: el(38), elbow_r: el(38),
    },
  },
  {
    id: "sit_relaxed",
    label: "기대어 앉기",
    group: "앉기",
    bones: {
      hip_l: hip(84, 16), hip_r: hip(84, 16),
      knee_l: kn(84), knee_r: kn(94),
      spine: spn(-14),
      chest: cst(-10),
      shoulder_l: sh(-62, -14), shoulder_r: sh(-62, -14),
      elbow_l: el(48), elbow_r: el(48),
      head: nk(-6, -8),
    },
  },
  {
    id: "sit_floor",
    label: "양반다리",
    group: "앉기",
    bones: {
      hip_l: hip(68, 56), hip_r: hip(68, 56),
      knee_l: kn(112), knee_r: kn(112),
      spine: spn(6),
      shoulder_l: sh(-64, 16), shoulder_r: sh(-64, 16),
      elbow_l: el(52), elbow_r: el(52),
    },
  },
  {
    id: "kneel",
    label: "무릎 꿇기",
    group: "앉기",
    bones: {
      hip_l: hip(14, 5), hip_r: hip(14, 5),
      knee_l: kn(116), knee_r: kn(116),
      ankle_l: ank(-38), ankle_r: ank(-38),
      spine: spn(5),
      shoulder_l: sh(-74, 8), shoulder_r: sh(-74, 8),
      elbow_l: el(22), elbow_r: el(22),
    },
  },
  {
    id: "kneel_one",
    label: "한쪽 무릎",
    group: "앉기",
    bones: {
      hip_l: hip(90, 10), knee_l: kn(90),
      hip_r: hip(12, 4), knee_r: kn(114), ankle_r: ank(-36),
      spine: spn(8),
      shoulder_l: sh(-64, 18), elbow_l: el(50),
      shoulder_r: sh(-72, 8), elbow_r: el(26),
      head: nk(-6),
    },
  },
  {
    id: "squat",
    label: "쪼그려 앉기",
    group: "앉기",
    bones: {
      hip_l: hip(108, 20), hip_r: hip(108, 20),
      knee_l: kn(116), knee_r: kn(116),
      ankle_l: ank(26), ankle_r: ank(26),
      spine: spn(22),
      chest: cst(10),
      shoulder_l: sh(-52, 34), shoulder_r: sh(-52, 34),
      elbow_l: el(68), elbow_r: el(68),
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
      shoulder_l: sh(-74, -20), elbow_l: el(24),
      shoulder_r: sh(-74, 22), elbow_r: el(24),
      spine: spn(3, -5),
      chest: cst(0, 6),
    },
  },
  {
    id: "run",
    label: "달리기",
    group: "이동",
    bones: {
      hip_l: hip(56, 4), knee_l: kn(76), ankle_l: ank(12),
      hip_r: hip(-36, 4), knee_r: kn(46), ankle_r: ank(-22),
      shoulder_l: sh(-66, -46), elbow_l: el(82),
      shoulder_r: sh(-66, 48), elbow_r: el(86),
      spine: spn(16, -8),
      chest: cst(6, 10),
      head: nk(-10),
    },
  },
  {
    id: "sprint",
    label: "전력질주",
    group: "이동",
    bones: {
      hip_l: hip(82, 4), knee_l: kn(94), ankle_l: ank(16),
      hip_r: hip(-50, 4), knee_r: kn(62), ankle_r: ank(-32),
      shoulder_l: sh(-58, -62), elbow_l: el(96),
      shoulder_r: sh(-58, 66), elbow_r: el(100),
      spine: spn(28, -10),
      chest: cst(14, 12),
      neck: nk(-22),
      head: nk(-18),
    },
  },
  {
    id: "jump",
    label: "점프",
    group: "이동",
    bones: {
      shoulder_l: sh(88, 10), shoulder_r: sh(88, 10),
      elbow_l: el(16), elbow_r: el(16),
      hip_l: hip(44, 12), knee_l: kn(70),
      hip_r: hip(32, 12), knee_r: kn(56),
      ankle_l: ank(-24), ankle_r: ank(-24),
      spine: spn(-12),
      chest: cst(-10),
      head: nk(-14),
    },
  },
  {
    id: "land",
    label: "착지",
    group: "이동",
    bones: {
      hip_l: hip(94, 24), knee_l: kn(106), ankle_l: ank(22),
      hip_r: hip(58, 18), knee_r: kn(82), ankle_r: ank(16),
      spine: spn(26, 10),
      chest: cst(14, 8),
      shoulder_l: sh(-46, 62), elbow_l: el(28),
      shoulder_r: sh(-88, -30), elbow_r: el(44),
      head: nk(-10, -12),
    },
  },
  {
    id: "climb",
    label: "기어오르기",
    group: "이동",
    bones: {
      shoulder_l: sh(96, 14), elbow_l: el(22),
      shoulder_r: sh(40, 30), elbow_r: el(76),
      hip_l: hip(72, 26), knee_l: kn(86),
      hip_r: hip(12, 8), knee_r: kn(32),
      spine: spn(12, 12),
      chest: cst(8, 10),
      head: nk(-16),
    },
  },

  // ───────────────────────── 액션 ─────────────────────────
  {
    id: "action",
    label: "액션",
    group: "액션",
    bones: {
      shoulder_l: sh(78, -16), elbow_l: el(78),
      shoulder_r: sh(-72, -34), elbow_r: el(30),
      hip_l: hip(-24, 5), knee_l: kn(20),
      hip_r: hip(34, 5), knee_r: kn(68),
      spine: spn(10, 15),
      chest: cst(0, 12),
      head: nk(0, -15),
    },
  },
  {
    id: "dynamic",
    label: "다이나믹",
    group: "액션",
    bones: {
      shoulder_l: sh(102, 18), elbow_l: el(48),
      shoulder_r: sh(-84, -48), elbow_r: el(68),
      hip_l: hip(58, 10), knee_l: kn(88),
      hip_r: hip(-28, 8), knee_r: kn(24),
      spine: spn(-12, -20, -8),
      chest: cst(-8, -12),
      neck: nk(10, 15),
      head: nk(8, 20),
    },
  },
  {
    id: "punch",
    label: "펀치",
    group: "액션",
    bones: {
      shoulder_r: sh(-14, 88), elbow_r: el(6),
      shoulder_l: sh(-56, -22), elbow_l: el(96),
      spine: spn(0, -26),
      chest: cst(6, -22),
      hip_l: hip(-18, 8), knee_l: kn(22),
      hip_r: hip(24, 10), knee_r: kn(40),
      head: nk(0, -10),
    },
  },
  {
    id: "kick",
    label: "하이킥",
    group: "액션",
    bones: {
      hip_r: hip(110, 14), knee_r: kn(12), ankle_r: ank(-18),
      hip_l: hip(-12, 6), knee_l: kn(16),
      spine: spn(-16, 12),
      chest: cst(-12, 10),
      shoulder_l: sh(-30, 52), elbow_l: el(44),
      shoulder_r: sh(-46, -38), elbow_r: el(36),
      head: nk(-8, 8),
    },
  },
  {
    id: "guard",
    label: "가드",
    group: "액션",
    bones: {
      shoulder_l: sh(-34, 44), elbow_l: el(110),
      shoulder_r: sh(-30, 50), elbow_r: el(114),
      spine: spn(10, 14),
      chest: cst(8, 12),
      hip_l: hip(-16, 10), knee_l: kn(30),
      hip_r: hip(18, 12), knee_r: kn(42),
      head: nk(-6, -12),
    },
  },
  {
    id: "sword",
    label: "검 내려베기",
    group: "액션",
    bones: {
      shoulder_l: sh(80, 26), elbow_l: el(58),
      shoulder_r: sh(74, 30), elbow_r: el(54),
      spine: spn(10, 14),
      chest: cst(8, 12),
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
      shoulder_l: sh(-6, 84), elbow_l: el(6),
      shoulder_r: sh(-16, 26), elbow_r: el(104),
      spine: spn(0, 24),
      chest: cst(0, 20),
      hip_l: hip(-10, 16), hip_r: hip(6, 16), knee_r: kn(16),
      head: nk(0, 34),
    },
  },
  {
    id: "dodge",
    label: "회피",
    group: "액션",
    bones: {
      spine: spn(-26, -18, -14),
      chest: cst(-20, -14, -10),
      neck: nk(-14, -14),
      head: nk(-12, -18, -10),
      shoulder_l: sh(-40, -34), elbow_l: el(56),
      shoulder_r: sh(-34, -50), elbow_r: el(62),
      hip_l: hip(-22, 18), knee_l: kn(34),
      hip_r: hip(16, 22), knee_r: kn(52),
    },
  },

  // ───────────────────────── 제스처 ─────────────────────────
  {
    id: "wave",
    label: "손 흔들기",
    group: "제스처",
    bones: {
      shoulder_r: sh(52, 12), elbow_r: el(58),
      shoulder_l: sh(-78), elbow_l: el(12),
      chest: cst(0, -6),
      head: nk(-6, 8, 6),
    },
  },
  {
    id: "cheer",
    label: "만세",
    group: "제스처",
    bones: {
      shoulder_l: sh(86, 6), shoulder_r: sh(86, 6),
      elbow_l: el(12), elbow_r: el(12),
      spine: spn(-14),
      chest: cst(-12),
      neck: nk(-14),
      head: nk(-16),
    },
  },
  {
    id: "think",
    label: "생각하기",
    group: "제스처",
    bones: {
      shoulder_r: sh(-38, 44), elbow_r: el(112),
      shoulder_l: sh(-58, 22), elbow_l: el(76),
      spine: spn(6),
      chest: cst(5),
      neck: nk(10, -10),
      head: nk(12, -12, -8),
    },
  },
  {
    id: "point",
    label: "가리키기",
    group: "제스처",
    bones: {
      shoulder_r: sh(-8, 84), elbow_r: el(8),
      finger1_r1: [deg(-10), 0, 0],
      finger2_r1: [deg(74), 0, 0],
      finger2_r2: [deg(66), 0, 0],
      shoulder_l: sh(-76), elbow_l: el(16),
      spine: spn(0, -12),
      chest: cst(0, -10),
      head: nk(0, -8),
    },
  },
  {
    id: "bow_greet",
    label: "인사",
    group: "제스처",
    bones: {
      spine: spn(30),
      chest: cst(24),
      neck: nk(16),
      head: nk(14),
      shoulder_l: sh(-72, 14), shoulder_r: sh(-72, 14),
      elbow_l: el(24), elbow_r: el(24),
      hip_l: hip(-6, 4), hip_r: hip(-6, 4),
    },
  },
  {
    id: "clap",
    label: "박수",
    group: "제스처",
    bones: {
      shoulder_l: sh(-44, 42), shoulder_r: sh(-44, 42),
      elbow_l: el(86), elbow_r: el(86),
      chest: cst(4),
      head: nk(-6),
    },
  },
  {
    id: "salute",
    label: "경례",
    group: "제스처",
    bones: {
      shoulder_r: sh(18, 40), elbow_r: el(110),
      shoulder_l: sh(-86), elbow_l: el(4),
      spine: spn(-5),
      chest: cst(-6),
      head: nk(-6),
    },
  },
  {
    id: "shrug",
    label: "어깨 으쓱",
    group: "제스처",
    bones: {
      shoulder_l: sh(-56, 8), shoulder_r: sh(-56, 8),
      elbow_l: el(82), elbow_r: el(82),
      wrist_l: [0, 0, deg(-22)], wrist_r: [0, 0, deg(-22)],
      neck: nk(10),
      head: nk(8, 0, 8),
    },
  },

  // ───────────────────────── 일상 ─────────────────────────
  {
    id: "stretch",
    label: "기지개",
    group: "일상",
    bones: {
      shoulder_l: sh(92, 10), shoulder_r: sh(92, 10),
      elbow_l: el(24), elbow_r: el(24),
      spine: spn(-24),
      chest: cst(-20),
      neck: nk(-22),
      head: nk(-20),
      hip_l: hip(-8, 6), hip_r: hip(-8, 6),
    },
  },
  {
    id: "selfie",
    label: "셀카",
    group: "일상",
    bones: {
      shoulder_r: sh(26, 62), elbow_r: el(52),
      shoulder_l: sh(-58, 26), elbow_l: el(60),
      spine: spn(0, -10, -6),
      chest: cst(0, -8, -4),
      neck: nk(-8, -8),
      head: nk(-10, -10, -12),
    },
  },
  {
    id: "read",
    label: "독서",
    group: "일상",
    bones: {
      shoulder_l: sh(-46, 54), shoulder_r: sh(-46, 54),
      elbow_l: el(74), elbow_r: el(74),
      spine: spn(12),
      chest: cst(10),
      neck: nk(24),
      head: nk(22),
    },
  },
  {
    id: "phone",
    label: "휴대폰 보기",
    group: "일상",
    bones: {
      shoulder_l: sh(-50, 48), elbow_l: el(92),
      shoulder_r: sh(-60, 38), elbow_r: el(70),
      spine: spn(10),
      chest: cst(8),
      neck: nk(26),
      head: nk(24, -6),
    },
  },
  {
    id: "lean_side",
    label: "기대기",
    group: "일상",
    bones: {
      root: [0, 0, deg(14)],
      spine: spn(0, -8, -12),
      chest: cst(0, -6, -8),
      shoulder_l: sh(-88, -26), elbow_l: el(22),
      shoulder_r: sh(-70, 6), elbow_r: el(26),
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
