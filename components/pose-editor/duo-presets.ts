import { clampBones } from "./presets";

const deg = (d: number) => (d * Math.PI) / 180;

// ── 2인 장면 프리셋 ──
//
// 단일 프리셋과 달리 뼈만으로는 구도가 나오지 않는다. "마주 본다"·"등을 맞댄다"는
// 배치(position)와 방향(rotationY)의 문제이므로 셋을 함께 정의한다.
//
// 좌표 규약 (⚠️ 틀리면 팔이 반대로 뻗는다):
//   · 마네킹은 기본적으로 +Z(카메라)를 본다.
//   · rotationY = θ 는 정면을 (sin θ, 0, cos θ)로 돌린다.
//       +90° → +X(화면 오른쪽)를 봄   |   −90° → −X를 봄
//   · +Z를 볼 때 캐릭터의 왼쪽은 월드 +X, 오른쪽은 −X다.
//       → 정면(rotationY 0)으로 나란히 설 때, 왼쪽 피규어가 오른쪽 상대에게
//         팔을 뻗으려면 **왼팔**(shoulder_l)을 써야 한다.
//   · 서로 마주 볼 때는 둘 다 "앞으로"(shoulder x +) 뻗으면 서로를 향한다.

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
        shoulder_l: [deg(24), 0, deg(-14)],
        elbow_l: [deg(72), 0, 0],
        shoulder_r: [deg(10), 0, deg(-8)],
        elbow_r: [deg(26), 0, 0],
        spine: [deg(3), deg(8), 0],
        chest: [0, deg(6), 0],
        head: [0, deg(10), 0],
      },
    },
    right: {
      position: [0.52, 0, 0],
      rotationY: deg(-68),
      bones: {
        shoulder_r: [deg(20), 0, deg(14)],
        elbow_r: [deg(66), 0, 0],
        shoulder_l: [deg(8), 0, deg(8)],
        elbow_l: [deg(22), 0, 0],
        spine: [deg(3), deg(-8), 0],
        chest: [0, deg(-6), 0],
        head: [deg(-4), deg(-10), deg(5)],
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
        shoulder_l: [deg(52), 0, deg(-20)],
        elbow_l: [deg(84), 0, 0],
        wrist_l: [deg(-20), 0, 0],
        shoulder_r: [deg(30), 0, deg(-14)],
        elbow_r: [deg(70), 0, 0],
        spine: [deg(5), deg(10), 0],
        chest: [deg(4), deg(8), 0],
        head: [0, deg(8), 0],
      },
    },
    right: {
      position: [0.55, 0, 0],
      rotationY: deg(-66),
      bones: {
        shoulder_l: [deg(26), 0, deg(-26)],
        shoulder_r: [deg(26), 0, deg(26)],
        elbow_l: [deg(108), 0, 0],
        elbow_r: [deg(108), 0, 0],
        chest: [deg(5), 0, 0],
        neck: [deg(8), 0, 0],
        head: [deg(8), deg(-8), deg(6)],
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
        shoulder_r: [deg(68), 0, deg(-16)],
        elbow_r: [deg(48), 0, 0],
        wrist_r: [deg(-10), 0, 0],
        shoulder_l: [deg(6), 0, deg(8)],
        elbow_l: [deg(18), 0, 0],
        spine: [deg(6), deg(6), 0],
        chest: [deg(4), 0, 0],
        head: [0, deg(6), 0],
      },
    },
    right: {
      position: [0.42, 0, 0],
      rotationY: deg(-82),
      bones: {
        shoulder_r: [deg(68), 0, deg(-16)],
        elbow_r: [deg(48), 0, 0],
        wrist_r: [deg(-10), 0, 0],
        shoulder_l: [deg(6), 0, deg(8)],
        elbow_l: [deg(18), 0, 0],
        spine: [deg(6), deg(6), 0],
        chest: [deg(4), 0, 0],
        head: [0, deg(6), 0],
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
        shoulder_r: [deg(112), 0, deg(-18)],
        elbow_r: [deg(26), 0, 0],
        shoulder_l: [deg(-16), 0, deg(20)],
        elbow_l: [deg(34), 0, 0],
        spine: [deg(-8), deg(6), 0],
        chest: [deg(-8), 0, 0],
        neck: [deg(-12), 0, 0],
        head: [deg(-12), deg(6), 0],
        hip_r: [deg(-12), 0, deg(-6)],
        knee_r: [deg(-18), 0, 0],
      },
    },
    right: {
      position: [0.46, 0, 0],
      rotationY: deg(-78),
      bones: {
        shoulder_r: [deg(112), 0, deg(-18)],
        elbow_r: [deg(26), 0, 0],
        shoulder_l: [deg(-16), 0, deg(20)],
        elbow_l: [deg(34), 0, 0],
        spine: [deg(-8), deg(6), 0],
        chest: [deg(-8), 0, 0],
        neck: [deg(-12), 0, 0],
        head: [deg(-12), deg(6), 0],
        hip_r: [deg(-12), 0, deg(-6)],
        knee_r: [deg(-18), 0, 0],
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
        shoulder_l: [deg(58), 0, deg(34)],
        elbow_l: [deg(92), 0, 0],
        shoulder_r: [deg(44), 0, deg(-30)],
        elbow_r: [deg(96), 0, 0],
        spine: [deg(8), 0, 0],
        chest: [deg(6), 0, 0],
        neck: [deg(6), 0, deg(10)],
        head: [deg(6), 0, deg(12)],
      },
    },
    right: {
      position: [0.28, 0, 0],
      rotationY: deg(-84),
      bones: {
        shoulder_l: [deg(48), 0, deg(30)],
        elbow_l: [deg(96), 0, 0],
        shoulder_r: [deg(62), 0, deg(-36)],
        elbow_r: [deg(90), 0, 0],
        spine: [deg(8), 0, 0],
        chest: [deg(6), 0, 0],
        neck: [deg(6), 0, deg(-10)],
        head: [deg(6), 0, deg(-12)],
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
      bones: {
        // 정면(+Z)을 볼 때 캐릭터의 왼쪽이 +X — 오른쪽 상대에게 두르려면 왼팔.
        shoulder_l: [deg(62), 0, deg(56)],
        elbow_l: [deg(76), 0, 0],
        shoulder_r: [deg(8), 0, deg(-8)],
        elbow_r: [deg(20), 0, 0],
        chest: [0, deg(-6), 0],
        head: [0, deg(-10), deg(-6)],
      },
    },
    right: {
      position: [0.33, 0, 0],
      rotationY: deg(8),
      bones: {
        shoulder_r: [deg(62), 0, deg(-56)],
        elbow_r: [deg(76), 0, 0],
        shoulder_l: [deg(8), 0, deg(8)],
        elbow_l: [deg(20), 0, 0],
        chest: [0, deg(6), 0],
        head: [0, deg(10), deg(6)],
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
        shoulder_l: [deg(14), 0, deg(20)],
        elbow_l: [deg(20), 0, 0],
        shoulder_r: [deg(6), 0, deg(-6)],
        elbow_r: [deg(14), 0, 0],
        head: [0, deg(-12), 0],
      },
    },
    right: {
      position: [0.3, 0, 0],
      rotationY: deg(6),
      bones: {
        shoulder_r: [deg(14), 0, deg(-20)],
        elbow_r: [deg(20), 0, 0],
        shoulder_l: [deg(6), 0, deg(6)],
        elbow_l: [deg(14), 0, 0],
        head: [0, deg(12), 0],
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
        shoulder_l: [deg(26), 0, deg(-26)],
        shoulder_r: [deg(26), 0, deg(26)],
        elbow_l: [deg(106), 0, 0],
        elbow_r: [deg(106), 0, 0],
        chest: [deg(-6), 0, 0],
        head: [deg(-6), deg(-14), 0],
      },
    },
    right: {
      position: [0.24, 0, 0],
      rotationY: deg(96),
      bones: {
        shoulder_l: [deg(26), 0, deg(-26)],
        shoulder_r: [deg(26), 0, deg(26)],
        elbow_l: [deg(106), 0, 0],
        elbow_r: [deg(106), 0, 0],
        chest: [deg(-6), 0, 0],
        head: [deg(-6), deg(14), 0],
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
        shoulder_l: [deg(46), 0, deg(-22)],
        elbow_l: [deg(112), 0, 0],
        shoulder_r: [deg(52), 0, deg(18)],
        elbow_r: [deg(116), 0, 0],
        spine: [deg(10), deg(12), 0],
        chest: [deg(8), deg(10), 0],
        hip_l: [deg(-16), 0, deg(10)],
        knee_l: [deg(-30), 0, 0],
        hip_r: [deg(18), 0, deg(-12)],
        knee_r: [deg(-42), 0, 0],
        head: [deg(-6), deg(8), 0],
      },
    },
    right: {
      position: [0.92, 0, 0],
      rotationY: deg(-76),
      bones: {
        shoulder_l: [deg(46), 0, deg(-22)],
        elbow_l: [deg(112), 0, 0],
        shoulder_r: [deg(52), 0, deg(18)],
        elbow_r: [deg(116), 0, 0],
        spine: [deg(10), deg(12), 0],
        chest: [deg(8), deg(10), 0],
        hip_l: [deg(-16), 0, deg(10)],
        knee_l: [deg(-30), 0, 0],
        hip_r: [deg(18), 0, deg(-12)],
        knee_r: [deg(-42), 0, 0],
        head: [deg(-6), deg(8), 0],
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
        shoulder_r: [deg(88), 0, deg(-6)],
        elbow_r: [deg(8), 0, 0],
        shoulder_l: [deg(-26), 0, deg(18)],
        elbow_l: [deg(96), 0, 0],
        spine: [deg(6), deg(-18), 0],
        chest: [deg(8), deg(-16), 0],
        hip_l: [deg(-20), 0, deg(8)],
        knee_l: [deg(-24), 0, 0],
        hip_r: [deg(26), 0, deg(-10)],
        knee_r: [deg(-44), 0, 0],
        head: [deg(-4), deg(-8), 0],
      },
    },
    right: {
      position: [0.55, 0, 0],
      rotationY: deg(-84),
      bones: {
        shoulder_l: [deg(64), 0, deg(-34)],
        elbow_l: [deg(114), 0, 0],
        shoulder_r: [deg(58), 0, deg(28)],
        elbow_r: [deg(110), 0, 0],
        spine: [deg(-22), deg(10), 0],
        chest: [deg(-18), deg(8), 0],
        neck: [deg(-14), 0, 0],
        head: [deg(-14), deg(-8), 0],
        hip_l: [deg(-18), 0, deg(12)],
        knee_l: [deg(-28), 0, 0],
        hip_r: [deg(10), 0, deg(-14)],
        knee_r: [deg(-46), 0, 0],
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
        shoulder_l: [deg(96), 0, deg(-24)],
        elbow_l: [deg(58), 0, 0],
        shoulder_r: [deg(88), 0, deg(20)],
        elbow_r: [deg(54), 0, 0],
        spine: [deg(10), deg(14), 0],
        chest: [deg(8), deg(12), 0],
        hip_l: [deg(30), 0, deg(14)],
        knee_l: [deg(-48), 0, 0],
        hip_r: [deg(-26), 0, deg(-10)],
        knee_r: [deg(-20), 0, 0],
        head: [deg(-8), deg(6), 0],
      },
    },
    right: {
      position: [0.44, 0, 0],
      rotationY: deg(-80),
      bones: {
        shoulder_l: [deg(96), 0, deg(-24)],
        elbow_l: [deg(58), 0, 0],
        shoulder_r: [deg(88), 0, deg(20)],
        elbow_r: [deg(54), 0, 0],
        spine: [deg(10), deg(14), 0],
        chest: [deg(8), deg(12), 0],
        hip_l: [deg(30), 0, deg(14)],
        knee_l: [deg(-48), 0, 0],
        hip_r: [deg(-26), 0, deg(-10)],
        knee_r: [deg(-20), 0, 0],
        head: [deg(-8), deg(6), 0],
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
        hip_l: [deg(94), 0, deg(12)],
        knee_l: [deg(-92), 0, 0],
        hip_r: [deg(16), 0, deg(-6)],
        knee_r: [deg(-116), 0, 0],
        ankle_r: [deg(-38), 0, 0],
        shoulder_l: [deg(46), 0, deg(-18)],
        elbow_l: [deg(64), 0, 0],
        shoulder_r: [deg(20), 0, deg(-10)],
        elbow_r: [deg(40), 0, 0],
        spine: [deg(-10), 0, 0],
        chest: [deg(-10), 0, 0],
        neck: [deg(-28), 0, 0],
        head: [deg(-30), deg(6), 0],
      },
    },
    right: {
      position: [0.44, 0, 0],
      rotationY: deg(-76),
      bones: {
        shoulder_l: [deg(24), 0, deg(-16)],
        elbow_l: [deg(62), 0, 0],
        shoulder_r: [deg(10), 0, deg(10)],
        elbow_r: [deg(24), 0, 0],
        spine: [deg(10), 0, 0],
        chest: [deg(8), 0, 0],
        neck: [deg(26), 0, 0],
        head: [deg(28), deg(-6), deg(6)],
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
        shoulder_r: [deg(84), 0, deg(-10)],
        elbow_r: [deg(8), 0, 0],
        finger1_r1: [deg(-10), 0, 0],
        finger2_r1: [deg(74), 0, 0],
        finger2_r2: [deg(66), 0, 0],
        shoulder_l: [deg(8), 0, deg(8)],
        elbow_l: [deg(20), 0, 0],
        spine: [deg(4), deg(10), 0],
        chest: [deg(4), deg(8), 0],
        head: [0, deg(8), 0],
      },
    },
    right: {
      position: [0.62, 0, 0],
      rotationY: deg(-70),
      bones: {
        shoulder_l: [deg(52), 0, deg(-40)],
        elbow_l: [deg(88), 0, 0],
        shoulder_r: [deg(46), 0, deg(38)],
        elbow_r: [deg(84), 0, 0],
        spine: [deg(-24), deg(8), 0],
        chest: [deg(-18), deg(6), 0],
        neck: [deg(-16), 0, 0],
        head: [deg(-16), deg(-6), 0],
        hip_r: [deg(-16), 0, deg(-8)],
        knee_r: [deg(-30), 0, 0],
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
        hip_l: [deg(28), 0, deg(3)],
        knee_l: [deg(-16), 0, 0],
        ankle_l: [deg(10), 0, 0],
        hip_r: [deg(-22), 0, deg(-3)],
        knee_r: [deg(-32), 0, 0],
        ankle_r: [deg(-14), 0, 0],
        shoulder_l: [deg(-20), 0, deg(6)],
        elbow_l: [deg(24), 0, 0],
        shoulder_r: [deg(22), 0, deg(-6)],
        elbow_r: [deg(26), 0, 0],
        spine: [deg(4), deg(-4), 0],
        head: [0, deg(-10), 0],
      },
    },
    right: {
      // 좌우 다리를 반대 위상으로 — 둘이 똑같이 걸으면 어색하다.
      position: [0.4, 0, 0],
      rotationY: deg(5),
      bones: {
        hip_r: [deg(28), 0, deg(-3)],
        knee_r: [deg(-16), 0, 0],
        ankle_r: [deg(10), 0, 0],
        hip_l: [deg(-22), 0, deg(3)],
        knee_l: [deg(-32), 0, 0],
        ankle_l: [deg(-14), 0, 0],
        shoulder_r: [deg(-20), 0, deg(-6)],
        elbow_r: [deg(24), 0, 0],
        shoulder_l: [deg(22), 0, deg(6)],
        elbow_l: [deg(26), 0, 0],
        spine: [deg(4), deg(4), 0],
        head: [0, deg(10), 0],
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
        shoulder_r: [deg(104), 0, deg(-22)],
        elbow_r: [deg(34), 0, 0],
        shoulder_l: [deg(38), 0, deg(30)],
        elbow_l: [deg(88), 0, 0],
        spine: [deg(-8), deg(6), deg(6)],
        chest: [deg(-6), 0, deg(4)],
        head: [deg(-8), deg(8), deg(-8)],
        hip_r: [deg(-14), 0, deg(-10)],
        knee_r: [deg(-22), 0, 0],
      },
    },
    right: {
      position: [0.36, 0, 0],
      rotationY: deg(-80),
      bones: {
        shoulder_l: [deg(104), 0, deg(22)],
        elbow_l: [deg(34), 0, 0],
        shoulder_r: [deg(38), 0, deg(-30)],
        elbow_r: [deg(88), 0, 0],
        spine: [deg(-8), deg(-6), deg(-6)],
        chest: [deg(-6), 0, deg(-4)],
        head: [deg(-8), deg(-8), deg(8)],
        hip_l: [deg(-14), 0, deg(10)],
        knee_l: [deg(-22), 0, 0],
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
