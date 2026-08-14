import { clampBones, sh, el, hip, kn, ank, spn, cst, nk } from "./presets";

const deg = (d: number) => (d * Math.PI) / 180;

// ── 2인 장면 프리셋 ──
//
// 단일 프리셋과 달리 뼈만으로는 구도가 나오지 않는다. "마주 본다"·"등을 맞댄다"는
// 배치(position)와 방향(rotationY)의 문제이므로 셋을 함께 정의한다.
//
// 뼈 값은 presets.ts의 의미 헬퍼(sh/el/hip/…)로만 쓴다 — 리그의 실제 축은
// 직관과 다르고 좌우 미러링도 없어서, raw로 쓰면 반드시 틀린다.
//
// 배치 규약 (⚠️ 틀리면 등을 돌리거나 팔이 반대로 뻗는다):
//   · 마네킹은 기본적으로 +Z(카메라)를 본다.
//   · rotationY = θ 는 정면을 (sin θ, 0, cos θ)로 돌린다.
//       +90° → +X(화면 오른쪽)를 봄   |   −90° → −X를 봄
//     따라서 마주 보려면 왼쪽 피규어가 +, 오른쪽 피규어가 −.
//   · 서로 마주 볼 때는 양쪽 다 sh(_, fwd+)로 뻗으면 서로를 향한다.
//   · 정면(rotationY≈0)으로 나란히 설 때는 T-포즈 기준 팔이 이미 옆으로
//     뻗어 있으므로, 상대 쪽 팔은 up만 살짝 올리면 어깨에 닿는다.

export type DuoGroup = "대화" | "친밀" | "전투" | "연출";

export const DUO_GROUPS: DuoGroup[] = ["대화", "친밀", "전투", "연출"];

export type FigurePlacement = {
  bones: Record<string, [number, number, number]>;
  position: [number, number, number];
  rotationY: number;
};

export type DuoPreset = {
  id: string;
  label: string;
  group: DuoGroup;
  hint: string;
  /** 화면 왼쪽에 설 피규어 (장면의 1번) */
  left: FigurePlacement;
  /** 화면 오른쪽에 설 피규어 (장면의 2번) */
  right: FigurePlacement;
};

/** 팔을 자연스럽게 내린 기본 상체 — 대부분의 구도가 여기서 출발한다. */
const armsDown = (fwd = 0) => ({
  shoulder_l: sh(-76, fwd),
  shoulder_r: sh(-76, fwd),
  elbow_l: el(16),
  elbow_r: el(16),
});

export const DUO_PRESETS: DuoPreset[] = [
  // ───────────────────────── 대화 ─────────────────────────
  {
    id: "talk",
    label: "마주보고 대화",
    group: "대화",
    hint: "3/4 각도로 서로를 보며 이야기",
    left: {
      position: [-0.52, 0, 0],
      rotationY: deg(68),
      bones: {
        ...armsDown(),
        shoulder_l: sh(-58, 26),
        elbow_l: el(70),
        spine: spn(3, 8),
        chest: cst(0, 6),
        head: nk(0, 10),
      },
    },
    right: {
      position: [0.52, 0, 0],
      rotationY: deg(-68),
      bones: {
        ...armsDown(),
        shoulder_r: sh(-62, 20),
        elbow_r: el(64),
        spine: spn(3, -8),
        chest: cst(0, -6),
        head: nk(-4, -10, 5),
      },
    },
  },
  {
    id: "listen",
    label: "설명과 경청",
    group: "대화",
    hint: "한쪽은 손짓하며 설명, 한쪽은 팔짱 끼고 들음",
    left: {
      position: [-0.55, 0, 0],
      rotationY: deg(72),
      bones: {
        ...armsDown(),
        shoulder_l: sh(-44, 52), elbow_l: el(84),
        shoulder_r: sh(-58, 30), elbow_r: el(70),
        spine: spn(5, 10),
        chest: cst(4, 8),
        head: nk(0, 8),
      },
    },
    right: {
      position: [0.55, 0, 0],
      rotationY: deg(-66),
      bones: {
        shoulder_l: sh(-52, 26), shoulder_r: sh(-52, 26),
        elbow_l: el(104), elbow_r: el(104),
        chest: cst(5),
        neck: nk(8),
        head: nk(8, -8, 6),
      },
    },
  },
  {
    id: "handshake",
    label: "악수",
    group: "대화",
    hint: "서로 오른손을 앞으로 뻗어 맞잡음",
    left: {
      position: [-0.42, 0, 0],
      rotationY: deg(82),
      bones: {
        ...armsDown(),
        shoulder_r: sh(-30, 74), elbow_r: el(44),
        spine: spn(6, 6),
        chest: cst(4),
        head: nk(0, 6),
      },
    },
    right: {
      position: [0.42, 0, 0],
      rotationY: deg(-82),
      bones: {
        ...armsDown(),
        shoulder_r: sh(-30, 74), elbow_r: el(44),
        spine: spn(6, 6),
        chest: cst(4),
        head: nk(0, 6),
      },
    },
  },

  // ───────────────────────── 친밀 ─────────────────────────
  {
    id: "high_five",
    label: "하이파이브",
    group: "친밀",
    hint: "서로 오른손을 높이 들어 마주침",
    left: {
      position: [-0.46, 0, 0],
      rotationY: deg(78),
      bones: {
        ...armsDown(-14),
        shoulder_r: sh(74, 30), elbow_r: el(24),
        spine: spn(-8, 6),
        chest: cst(-8),
        neck: nk(-12),
        head: nk(-12, 6),
        hip_r: hip(-12, 6), knee_r: kn(18),
      },
    },
    right: {
      position: [0.46, 0, 0],
      rotationY: deg(-78),
      bones: {
        ...armsDown(-14),
        shoulder_r: sh(74, 30), elbow_r: el(24),
        spine: spn(-8, 6),
        chest: cst(-8),
        neck: nk(-12),
        head: nk(-12, 6),
        hip_r: hip(-12, 6), knee_r: kn(18),
      },
    },
  },
  {
    id: "hug",
    label: "포옹",
    group: "친밀",
    hint: "바짝 붙어 서로 팔을 두름",
    left: {
      position: [-0.28, 0, 0],
      rotationY: deg(84),
      bones: {
        shoulder_l: sh(-34, 58), elbow_l: el(92),
        shoulder_r: sh(-46, 50), elbow_r: el(96),
        spine: spn(8),
        chest: cst(6),
        neck: nk(6, 0, 10),
        head: nk(6, 0, 12),
      },
    },
    right: {
      position: [0.28, 0, 0],
      rotationY: deg(-84),
      bones: {
        shoulder_l: sh(-46, 50), elbow_l: el(96),
        shoulder_r: sh(-32, 62), elbow_r: el(90),
        spine: spn(8),
        chest: cst(6),
        neck: nk(6, 0, -10),
        head: nk(6, 0, -12),
      },
    },
  },
  {
    id: "shoulder_arm",
    label: "어깨동무",
    group: "친밀",
    hint: "정면을 보고 나란히, 안쪽 팔을 상대 어깨에",
    left: {
      position: [-0.33, 0, 0],
      rotationY: deg(-8),
      // T-포즈 기준 왼팔이 이미 +X(화면 오른쪽)를 향하므로, 오른쪽 상대에게
      // 두르려면 왼팔을 살짝 올리고 팔꿈치만 접으면 된다.
      bones: {
        shoulder_l: sh(8, 6), elbow_l: el(48, -18),
        shoulder_r: sh(-78), elbow_r: el(18),
        chest: cst(0, -6),
        head: nk(0, -10, -6),
      },
    },
    right: {
      position: [0.33, 0, 0],
      rotationY: deg(8),
      bones: {
        shoulder_r: sh(8, 6), elbow_r: el(48, -18),
        shoulder_l: sh(-78), elbow_l: el(18),
        chest: cst(0, 6),
        head: nk(0, 10, 6),
      },
    },
  },
  {
    id: "hold_hands",
    label: "손잡기",
    group: "친밀",
    hint: "정면을 보고 나란히, 안쪽 손을 맞잡음",
    left: {
      position: [-0.3, 0, 0],
      rotationY: deg(-6),
      bones: {
        shoulder_l: sh(-64), elbow_l: el(14),
        shoulder_r: sh(-78), elbow_r: el(14),
        head: nk(0, -12),
      },
    },
    right: {
      position: [0.3, 0, 0],
      rotationY: deg(6),
      bones: {
        shoulder_r: sh(-64), elbow_r: el(14),
        shoulder_l: sh(-78), elbow_l: el(14),
        head: nk(0, 12),
      },
    },
  },
  {
    id: "back_to_back",
    label: "등 맞대기",
    group: "친밀",
    hint: "서로 반대를 보고 등을 붙임",
    left: {
      // 등을 맞대려면 서로 바깥을 향해야 한다 — 왼쪽 피규어는 −X를 본다.
      position: [-0.24, 0, 0],
      rotationY: deg(-96),
      bones: {
        shoulder_l: sh(-52, 26), shoulder_r: sh(-52, 26),
        elbow_l: el(104), elbow_r: el(104),
        chest: cst(-6),
        head: nk(-6, -14),
      },
    },
    right: {
      position: [0.24, 0, 0],
      rotationY: deg(96),
      bones: {
        shoulder_l: sh(-52, 26), shoulder_r: sh(-52, 26),
        elbow_l: el(104), elbow_r: el(104),
        chest: cst(-6),
        head: nk(-6, 14),
      },
    },
  },

  // ───────────────────────── 전투 ─────────────────────────
  {
    id: "standoff",
    label: "대치",
    group: "전투",
    hint: "거리를 두고 마주 선 채 가드",
    left: {
      position: [-0.92, 0, 0],
      rotationY: deg(76),
      bones: {
        shoulder_l: sh(-34, 44), elbow_l: el(110),
        shoulder_r: sh(-30, 50), elbow_r: el(114),
        spine: spn(10, 12),
        chest: cst(8, 10),
        hip_l: hip(-16, 10), knee_l: kn(30),
        hip_r: hip(18, 12), knee_r: kn(42),
        head: nk(-6, 8),
      },
    },
    right: {
      position: [0.92, 0, 0],
      rotationY: deg(-76),
      bones: {
        shoulder_l: sh(-34, 44), elbow_l: el(110),
        shoulder_r: sh(-30, 50), elbow_r: el(114),
        spine: spn(10, 12),
        chest: cst(8, 10),
        hip_l: hip(-16, 10), knee_l: kn(30),
        hip_r: hip(18, 12), knee_r: kn(42),
        head: nk(-6, 8),
      },
    },
  },
  {
    id: "attack_block",
    label: "공격과 방어",
    group: "전투",
    hint: "왼쪽이 펀치, 오른쪽이 막으며 젖힘",
    left: {
      position: [-0.55, 0, 0],
      rotationY: deg(84),
      bones: {
        shoulder_r: sh(-14, 88), elbow_r: el(6),
        shoulder_l: sh(-56, -22), elbow_l: el(96),
        spine: spn(6, -18),
        chest: cst(8, -16),
        hip_l: hip(-20, 8), knee_l: kn(24),
        hip_r: hip(26, 10), knee_r: kn(44),
        head: nk(-4, -8),
      },
    },
    right: {
      position: [0.55, 0, 0],
      rotationY: deg(-84),
      bones: {
        shoulder_l: sh(-26, 58), elbow_l: el(112),
        shoulder_r: sh(-22, 62), elbow_r: el(108),
        spine: spn(-22, 10),
        chest: cst(-18, 8),
        neck: nk(-14),
        head: nk(-14, -8),
        hip_l: hip(-18, 12), knee_l: kn(28),
        hip_r: hip(10, 14), knee_r: kn(46),
      },
    },
  },
  {
    id: "clash",
    label: "무기 맞부딪힘",
    group: "전투",
    hint: "둘 다 내려베며 가운데서 충돌",
    left: {
      position: [-0.44, 0, 0],
      rotationY: deg(80),
      bones: {
        shoulder_l: sh(76, 26), elbow_l: el(56),
        shoulder_r: sh(72, 30), elbow_r: el(52),
        spine: spn(10, 14),
        chest: cst(8, 12),
        hip_l: hip(30, 14), knee_l: kn(46),
        hip_r: hip(-26, 10), knee_r: kn(18),
        head: nk(-8, 6),
      },
    },
    right: {
      position: [0.44, 0, 0],
      rotationY: deg(-80),
      bones: {
        shoulder_l: sh(76, 26), elbow_l: el(56),
        shoulder_r: sh(72, 30), elbow_r: el(52),
        spine: spn(10, 14),
        chest: cst(8, 12),
        hip_l: hip(30, 14), knee_l: kn(46),
        hip_r: hip(-26, 10), knee_r: kn(18),
        head: nk(-8, 6),
      },
    },
  },

  // ───────────────────────── 연출 ─────────────────────────
  {
    id: "kneel_look_up",
    label: "무릎 꿇고 올려다보기",
    group: "연출",
    hint: "한쪽은 한 무릎 꿇고 올려다보고, 한쪽은 내려다봄",
    left: {
      position: [-0.44, 0, 0],
      rotationY: deg(76),
      bones: {
        hip_l: hip(92, 12), knee_l: kn(90),
        hip_r: hip(14, 5), knee_r: kn(114), ankle_r: ank(-36),
        shoulder_l: sh(-40, 46), elbow_l: el(62),
        shoulder_r: sh(-64, 20), elbow_r: el(38),
        spine: spn(-10),
        chest: cst(-10),
        neck: nk(-26),
        head: nk(-28, 6),
      },
    },
    right: {
      position: [0.44, 0, 0],
      rotationY: deg(-76),
      bones: {
        ...armsDown(),
        shoulder_l: sh(-60, 24), elbow_l: el(60),
        spine: spn(10),
        chest: cst(8),
        neck: nk(24),
        head: nk(26, -6, 6),
      },
    },
  },
  {
    id: "point_react",
    label: "가리키기와 반응",
    group: "연출",
    hint: "왼쪽이 손가락으로 지목, 오른쪽이 놀라 젖힘",
    left: {
      position: [-0.62, 0, 0],
      rotationY: deg(70),
      bones: {
        ...armsDown(),
        shoulder_r: sh(-8, 84), elbow_r: el(8),
        finger1_r1: [deg(-10), 0, 0],
        finger2_r1: [deg(74), 0, 0],
        finger2_r2: [deg(66), 0, 0],
        spine: spn(4, 10),
        chest: cst(4, 8),
        head: nk(0, 8),
      },
    },
    right: {
      position: [0.62, 0, 0],
      rotationY: deg(-70),
      bones: {
        shoulder_l: sh(-30, 52), elbow_l: el(88),
        shoulder_r: sh(-34, 46), elbow_r: el(84),
        spine: spn(-24, 8),
        chest: cst(-18, 6),
        neck: nk(-16),
        head: nk(-16, -6),
        hip_r: hip(-16, 8), knee_r: kn(30),
      },
    },
  },
  {
    id: "walk_together",
    label: "나란히 걷기",
    group: "연출",
    hint: "정면으로 나란히, 걸음이 서로 엇갈림",
    left: {
      position: [-0.4, 0, 0],
      rotationY: deg(-5),
      bones: {
        hip_l: hip(26, 3), knee_l: kn(14), ankle_l: ank(8),
        hip_r: hip(-20, 3), knee_r: kn(30), ankle_r: ank(-12),
        shoulder_l: sh(-74, -20), elbow_l: el(24),
        shoulder_r: sh(-74, 22), elbow_r: el(24),
        spine: spn(3, -4),
        head: nk(0, -10),
      },
    },
    right: {
      // 다리를 반대 위상으로 — 둘이 똑같이 걸으면 어색하다.
      position: [0.4, 0, 0],
      rotationY: deg(5),
      bones: {
        hip_r: hip(26, 3), knee_r: kn(14), ankle_r: ank(8),
        hip_l: hip(-20, 3), knee_l: kn(30), ankle_l: ank(-12),
        shoulder_r: sh(-74, -20), elbow_r: el(24),
        shoulder_l: sh(-74, 22), elbow_l: el(24),
        spine: spn(3, 4),
        head: nk(0, 10),
      },
    },
  },
  {
    id: "dance",
    label: "춤",
    group: "연출",
    hint: "마주 보고 한 손은 맞잡아 높이, 한 손은 허리에",
    left: {
      position: [-0.36, 0, 0],
      rotationY: deg(80),
      bones: {
        shoulder_r: sh(72, 34), elbow_r: el(32),
        shoulder_l: sh(-46, 38), elbow_l: el(86),
        spine: spn(-8, 6, 6),
        chest: cst(-6, 0, 4),
        head: nk(-8, 8, -8),
        hip_r: hip(-14, 10), knee_r: kn(22),
      },
    },
    right: {
      position: [0.36, 0, 0],
      rotationY: deg(-80),
      bones: {
        shoulder_l: sh(72, 34), elbow_l: el(32),
        shoulder_r: sh(-46, 38), elbow_r: el(86),
        spine: spn(-8, -6, -6),
        chest: cst(-6, 0, -4),
        head: nk(-8, -8, 8),
        hip_l: hip(-14, 10), knee_l: kn(22),
      },
    },
  },
];

export function duoPresetsByGroup(): Record<DuoGroup, DuoPreset[]> {
  const out = {} as Record<DuoGroup, DuoPreset[]>;
  for (const g of DUO_GROUPS) out[g] = [];
  for (const p of DUO_PRESETS) out[p.group].push(p);
  return out;
}

/** 프리셋 한쪽을 피규어에 적용할 수 있는 형태로. 뼈는 가동범위로 잘린다. */
export function placementToFigurePatch(p: FigurePlacement) {
  return {
    bones: clampBones(p.bones),
    position: p.position,
    rotationY: p.rotationY,
  };
}
