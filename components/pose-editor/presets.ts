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

// ── Bony 리그의 회전 규약 (기존 프리셋에서 역산) ──
//  shoulder x: + 팔을 앞/위로   |  z: + 왼팔 바깥, − 오른팔 바깥 (좌우 대칭)
//  elbow    x: + 굽힘
//  hip      x: + 허벅지 앞으로  |  z: + 왼다리 바깥, − 오른다리 바깥
//  knee     x: − 굽힘 (뒤꿈치가 엉덩이 쪽으로)
//  ankle    x: + 발끝 들기      |  − 발끝 내리기
//  spine/chest x: + 앞으로 숙임 |  y: 비틀기 | z: 옆으로 기울임
//  neck/head   x: + 고개 숙임   |  y: 좌우 돌림 | z: 갸웃
//
// ⚠️ 모든 값은 적용 시 LIMITS로 잘린다. 몸통은 좁으니(spine ±30°, chest ±25°,
//    head/neck ±35/45/30°) 한계를 넘겨 적으면 의도한 자세가 나오지 않는다.
//    팔다리는 ±120°. 이 파일의 값은 전부 한계 안에서 작성돼 있다.
export const PRESETS: Preset[] = [
  // ───────────────────────── 서기 ─────────────────────────
  { id: "base", label: "기본 자세", group: "서기", bones: {} },
  {
    id: "attention",
    label: "차렷",
    group: "서기",
    bones: {
      shoulder_l: [0, 0, deg(-6)],
      shoulder_r: [0, 0, deg(6)],
      elbow_l: [deg(4), 0, 0],
      elbow_r: [deg(4), 0, 0],
      spine: [deg(-4), 0, 0],
      chest: [deg(-5), 0, 0],
    },
  },
  {
    id: "relaxed",
    label: "편하게 서기",
    group: "서기",
    bones: {
      shoulder_l: [deg(6), 0, deg(6)],
      shoulder_r: [deg(6), 0, deg(-6)],
      elbow_l: [deg(16), 0, 0],
      elbow_r: [deg(16), 0, 0],
      spine: [deg(3), 0, deg(-3)],
      head: [0, deg(-6), 0],
    },
  },
  {
    id: "contrapposto",
    label: "짝다리",
    group: "서기",
    bones: {
      root: [0, 0, deg(9)],
      spine: [0, 0, deg(-7)],
      chest: [0, 0, deg(-4)],
      hip_l: [deg(-6), 0, deg(6)],
      knee_l: [deg(-14), 0, 0],
      hip_r: [deg(2), 0, deg(-2)],
      shoulder_l: [deg(5), 0, deg(9)],
      shoulder_r: [deg(5), 0, deg(-4)],
      elbow_l: [deg(20), 0, 0],
      elbow_r: [deg(12), 0, 0],
      head: [0, deg(10), deg(-5)],
    },
  },
  {
    id: "arms_crossed",
    label: "팔짱",
    group: "서기",
    bones: {
      shoulder_l: [deg(26), 0, deg(-26)],
      shoulder_r: [deg(26), 0, deg(26)],
      elbow_l: [deg(108), 0, 0],
      elbow_r: [deg(108), 0, 0],
      chest: [deg(4), 0, 0],
      head: [deg(-4), deg(-8), 0],
    },
  },
  {
    id: "hands_hips",
    label: "허리에 손",
    group: "서기",
    bones: {
      shoulder_l: [deg(12), 0, deg(48)],
      shoulder_r: [deg(12), 0, deg(-48)],
      elbow_l: [deg(96), 0, 0],
      elbow_r: [deg(96), 0, 0],
      chest: [deg(-6), 0, 0],
      hip_l: [0, 0, deg(7)],
      hip_r: [0, 0, deg(-7)],
    },
  },
  {
    id: "hands_behind",
    label: "뒷짐",
    group: "서기",
    bones: {
      shoulder_l: [deg(-38), 0, deg(-8)],
      shoulder_r: [deg(-38), 0, deg(8)],
      elbow_l: [deg(62), 0, 0],
      elbow_r: [deg(62), 0, 0],
      chest: [deg(-8), 0, 0],
      head: [deg(-6), 0, 0],
    },
  },
  {
    id: "lean_back",
    label: "젖히기",
    group: "서기",
    bones: {
      spine: [deg(-22), 0, 0],
      chest: [deg(-18), 0, 0],
      neck: [deg(-20), 0, 0],
      head: [deg(-18), 0, 0],
      shoulder_l: [deg(-16), 0, deg(14)],
      shoulder_r: [deg(-16), 0, deg(-14)],
      hip_l: [deg(-10), 0, 0],
      hip_r: [deg(-10), 0, 0],
    },
  },

  // ───────────────────────── 앉기 ─────────────────────────
  {
    id: "sit",
    label: "의자에 앉기",
    group: "앉기",
    bones: {
      hip_l: [deg(100), 0, deg(8)],
      hip_r: [deg(100), 0, deg(-8)],
      knee_l: [deg(-105), 0, 0],
      knee_r: [deg(-105), 0, 0],
      spine: [deg(8), 0, 0],
      shoulder_l: [deg(15), 0, deg(5)],
      shoulder_r: [deg(15), 0, deg(-5)],
      elbow_l: [deg(40), 0, 0],
      elbow_r: [deg(40), 0, 0],
    },
  },
  {
    id: "sit_relaxed",
    label: "기대어 앉기",
    group: "앉기",
    bones: {
      hip_l: [deg(88), 0, deg(16)],
      hip_r: [deg(88), 0, deg(-16)],
      knee_l: [deg(-88), 0, 0],
      knee_r: [deg(-96), 0, 0],
      spine: [deg(-14), 0, 0],
      chest: [deg(-10), 0, 0],
      shoulder_l: [deg(-14), 0, deg(20)],
      shoulder_r: [deg(-14), 0, deg(-20)],
      elbow_l: [deg(52), 0, 0],
      elbow_r: [deg(52), 0, 0],
      head: [deg(-8), deg(-10), 0],
    },
  },
  {
    id: "sit_floor",
    label: "양반다리",
    group: "앉기",
    bones: {
      hip_l: [deg(78), 0, deg(58)],
      hip_r: [deg(78), 0, deg(-58)],
      knee_l: [deg(-112), 0, 0],
      knee_r: [deg(-112), 0, 0],
      spine: [deg(6), 0, 0],
      shoulder_l: [deg(14), 0, deg(12)],
      shoulder_r: [deg(14), 0, deg(-12)],
      elbow_l: [deg(58), 0, 0],
      elbow_r: [deg(58), 0, 0],
    },
  },
  {
    id: "kneel",
    label: "무릎 꿇기",
    group: "앉기",
    bones: {
      hip_l: [deg(18), 0, deg(6)],
      hip_r: [deg(18), 0, deg(-6)],
      knee_l: [deg(-118), 0, 0],
      knee_r: [deg(-118), 0, 0],
      ankle_l: [deg(-40), 0, 0],
      ankle_r: [deg(-40), 0, 0],
      spine: [deg(5), 0, 0],
      shoulder_l: [deg(8), 0, deg(5)],
      shoulder_r: [deg(8), 0, deg(-5)],
      elbow_l: [deg(24), 0, 0],
      elbow_r: [deg(24), 0, 0],
    },
  },
  {
    id: "kneel_one",
    label: "한쪽 무릎",
    group: "앉기",
    bones: {
      hip_l: [deg(92), 0, deg(10)],
      knee_l: [deg(-92), 0, 0],
      hip_r: [deg(16), 0, deg(-6)],
      knee_r: [deg(-116), 0, 0],
      ankle_r: [deg(-38), 0, 0],
      spine: [deg(8), 0, 0],
      shoulder_l: [deg(20), 0, deg(8)],
      elbow_l: [deg(52), 0, 0],
      shoulder_r: [deg(10), 0, deg(-6)],
      elbow_r: [deg(28), 0, 0],
      head: [deg(-6), 0, 0],
    },
  },
  {
    id: "squat",
    label: "쪼그려 앉기",
    group: "앉기",
    bones: {
      hip_l: [deg(112), 0, deg(20)],
      hip_r: [deg(112), 0, deg(-20)],
      knee_l: [deg(-118), 0, 0],
      knee_r: [deg(-118), 0, 0],
      ankle_l: [deg(28), 0, 0],
      ankle_r: [deg(28), 0, 0],
      spine: [deg(22), 0, 0],
      chest: [deg(10), 0, 0],
      shoulder_l: [deg(34), 0, deg(-10)],
      shoulder_r: [deg(34), 0, deg(10)],
      elbow_l: [deg(72), 0, 0],
      elbow_r: [deg(72), 0, 0],
    },
  },

  // ───────────────────────── 이동 ─────────────────────────
  {
    id: "walk",
    label: "걷기",
    group: "이동",
    bones: {
      hip_l: [deg(28), 0, deg(3)],
      knee_l: [deg(-16), 0, 0],
      ankle_l: [deg(10), 0, 0],
      hip_r: [deg(-22), 0, deg(-3)],
      knee_r: [deg(-32), 0, 0],
      ankle_r: [deg(-14), 0, 0],
      shoulder_l: [deg(-22), 0, deg(5)],
      elbow_l: [deg(26), 0, 0],
      shoulder_r: [deg(22), 0, deg(-5)],
      elbow_r: [deg(26), 0, 0],
      spine: [deg(4), deg(-5), 0],
      chest: [0, deg(6), 0],
    },
  },
  {
    id: "run",
    label: "달리기",
    group: "이동",
    bones: {
      hip_l: [deg(58), 0, deg(4)],
      knee_l: [deg(-78), 0, 0],
      ankle_l: [deg(14), 0, 0],
      hip_r: [deg(-38), 0, deg(-4)],
      knee_r: [deg(-48), 0, 0],
      ankle_r: [deg(-24), 0, 0],
      shoulder_l: [deg(-48), 0, deg(6)],
      elbow_l: [deg(82), 0, 0],
      shoulder_r: [deg(48), 0, deg(-6)],
      elbow_r: [deg(88), 0, 0],
      spine: [deg(16), deg(-8), 0],
      chest: [deg(8), deg(10), 0],
      head: [deg(-10), 0, 0],
    },
  },
  {
    id: "sprint",
    label: "전력질주",
    group: "이동",
    bones: {
      hip_l: [deg(84), 0, deg(4)],
      knee_l: [deg(-96), 0, 0],
      ankle_l: [deg(18), 0, 0],
      hip_r: [deg(-52), 0, deg(-4)],
      knee_r: [deg(-64), 0, 0],
      ankle_r: [deg(-34), 0, 0],
      shoulder_l: [deg(-62), 0, deg(8)],
      elbow_l: [deg(96), 0, 0],
      shoulder_r: [deg(66), 0, deg(-8)],
      elbow_r: [deg(102), 0, 0],
      spine: [deg(28), deg(-10), 0],
      chest: [deg(16), deg(12), 0],
      neck: [deg(-24), 0, 0],
      head: [deg(-20), 0, 0],
    },
  },
  {
    id: "jump",
    label: "점프",
    group: "이동",
    bones: {
      shoulder_l: [deg(112), 0, deg(16)],
      shoulder_r: [deg(112), 0, deg(-16)],
      elbow_l: [deg(18), 0, 0],
      elbow_r: [deg(18), 0, 0],
      hip_l: [deg(46), 0, deg(12)],
      knee_l: [deg(-72), 0, 0],
      hip_r: [deg(34), 0, deg(-12)],
      knee_r: [deg(-58), 0, 0],
      ankle_l: [deg(-26), 0, 0],
      ankle_r: [deg(-26), 0, 0],
      spine: [deg(-12), 0, 0],
      chest: [deg(-10), 0, 0],
      head: [deg(-14), 0, 0],
    },
  },
  {
    id: "land",
    label: "착지",
    group: "이동",
    bones: {
      hip_l: [deg(96), 0, deg(24)],
      knee_l: [deg(-108), 0, 0],
      ankle_l: [deg(24), 0, 0],
      hip_r: [deg(60), 0, deg(-18)],
      knee_r: [deg(-84), 0, 0],
      ankle_r: [deg(18), 0, 0],
      spine: [deg(26), deg(10), 0],
      chest: [deg(14), deg(8), 0],
      shoulder_l: [deg(64), 0, deg(-18)],
      elbow_l: [deg(30), 0, 0],
      shoulder_r: [deg(-40), 0, deg(-34)],
      elbow_r: [deg(46), 0, 0],
      head: [deg(-12), deg(-14), 0],
    },
  },
  {
    id: "climb",
    label: "기어오르기",
    group: "이동",
    bones: {
      shoulder_l: [deg(116), 0, deg(10)],
      elbow_l: [deg(24), 0, 0],
      shoulder_r: [deg(72), 0, deg(-14)],
      elbow_r: [deg(78), 0, 0],
      hip_l: [deg(74), 0, deg(26)],
      knee_l: [deg(-88), 0, 0],
      hip_r: [deg(14), 0, deg(-8)],
      knee_r: [deg(-34), 0, 0],
      spine: [deg(12), deg(12), 0],
      chest: [deg(8), deg(10), 0],
      head: [deg(-16), 0, 0],
    },
  },

  // ───────────────────────── 액션 ─────────────────────────
  {
    id: "action",
    label: "액션",
    group: "액션",
    bones: {
      shoulder_l: [deg(118), 0, deg(-10)],
      elbow_l: [deg(80), 0, 0],
      shoulder_r: [deg(-40), 0, deg(20)],
      elbow_r: [deg(30), 0, 0],
      hip_l: [deg(-25), 0, deg(5)],
      knee_l: [deg(-20), 0, 0],
      hip_r: [deg(35), 0, deg(-5)],
      knee_r: [deg(-70), 0, 0],
      spine: [deg(10), deg(15), 0],
      chest: [0, deg(12), 0],
      head: [0, deg(-15), 0],
    },
  },
  {
    id: "dynamic",
    label: "다이나믹",
    group: "액션",
    bones: {
      // 이전 값은 shoulder 160°로 한계(120°)를 넘겨 조용히 잘리고 있었다.
      shoulder_l: [deg(118), 0, deg(-15)],
      elbow_l: [deg(50), 0, 0],
      shoulder_r: [deg(-55), 0, deg(25)],
      elbow_r: [deg(70), 0, 0],
      hip_l: [deg(60), 0, deg(10)],
      knee_l: [deg(-90), 0, 0],
      hip_r: [deg(-30), 0, deg(-8)],
      knee_r: [deg(-25), 0, 0],
      spine: [deg(-12), deg(-20), deg(8)],
      chest: [deg(-8), deg(-12), 0],
      neck: [deg(10), deg(15), 0],
      head: [deg(8), deg(20), 0],
    },
  },
  {
    id: "punch",
    label: "펀치",
    group: "액션",
    bones: {
      shoulder_r: [deg(88), 0, deg(-6)],
      elbow_r: [deg(8), 0, 0],
      wrist_r: [0, 0, deg(-10)],
      shoulder_l: [deg(-26), 0, deg(18)],
      elbow_l: [deg(96), 0, 0],
      spine: [0, deg(-26), 0],
      chest: [deg(6), deg(-22), 0],
      hip_l: [deg(-18), 0, deg(8)],
      knee_l: [deg(-22), 0, 0],
      hip_r: [deg(24), 0, deg(-10)],
      knee_r: [deg(-40), 0, 0],
      head: [0, deg(-10), 0],
    },
  },
  {
    id: "kick",
    label: "하이킥",
    group: "액션",
    bones: {
      hip_r: [deg(112), 0, deg(-14)],
      knee_r: [deg(-14), 0, 0],
      ankle_r: [deg(-20), 0, 0],
      hip_l: [deg(-14), 0, deg(6)],
      knee_l: [deg(-16), 0, 0],
      spine: [deg(-16), deg(12), 0],
      chest: [deg(-12), deg(10), 0],
      shoulder_l: [deg(58), 0, deg(38)],
      elbow_l: [deg(46), 0, 0],
      shoulder_r: [deg(-34), 0, deg(-40)],
      elbow_r: [deg(38), 0, 0],
      head: [deg(-8), deg(8), 0],
    },
  },
  {
    id: "guard",
    label: "가드",
    group: "액션",
    bones: {
      shoulder_l: [deg(46), 0, deg(-22)],
      elbow_l: [deg(112), 0, 0],
      shoulder_r: [deg(52), 0, deg(18)],
      elbow_r: [deg(116), 0, 0],
      spine: [deg(10), deg(14), 0],
      chest: [deg(8), deg(12), 0],
      hip_l: [deg(-16), 0, deg(10)],
      knee_l: [deg(-30), 0, 0],
      hip_r: [deg(18), 0, deg(-12)],
      knee_r: [deg(-42), 0, 0],
      head: [deg(-6), deg(-12), 0],
    },
  },
  {
    id: "sword",
    label: "검 내려베기",
    group: "액션",
    bones: {
      shoulder_l: [deg(104), 0, deg(-28)],
      elbow_l: [deg(62), 0, 0],
      shoulder_r: [deg(96), 0, deg(24)],
      elbow_r: [deg(58), 0, 0],
      spine: [deg(-14), deg(18), 0],
      chest: [deg(-10), deg(14), 0],
      hip_l: [deg(28), 0, deg(14)],
      knee_l: [deg(-46), 0, 0],
      hip_r: [deg(-24), 0, deg(-10)],
      knee_r: [deg(-18), 0, 0],
      head: [deg(-10), deg(-10), 0],
    },
  },
  {
    id: "bow_shoot",
    label: "활 쏘기",
    group: "액션",
    bones: {
      shoulder_l: [deg(84), 0, deg(-8)],
      elbow_l: [deg(6), 0, 0],
      shoulder_r: [deg(24), 0, deg(-56)],
      elbow_r: [deg(104), 0, 0],
      spine: [0, deg(24), 0],
      chest: [0, deg(20), 0],
      hip_l: [deg(-10), 0, deg(16)],
      hip_r: [deg(6), 0, deg(-16)],
      knee_r: [deg(-16), 0, 0],
      head: [0, deg(-38), 0],
    },
  },
  {
    id: "dodge",
    label: "회피",
    group: "액션",
    bones: {
      spine: [deg(-26), deg(-18), deg(14)],
      chest: [deg(-20), deg(-14), deg(10)],
      neck: [deg(-16), deg(-14), 0],
      head: [deg(-14), deg(-18), deg(10)],
      shoulder_l: [deg(-34), 0, deg(46)],
      elbow_l: [deg(58), 0, 0],
      shoulder_r: [deg(-28), 0, deg(-52)],
      elbow_r: [deg(64), 0, 0],
      hip_l: [deg(-22), 0, deg(18)],
      knee_l: [deg(-34), 0, 0],
      hip_r: [deg(16), 0, deg(-22)],
      knee_r: [deg(-52), 0, 0],
    },
  },

  // ───────────────────────── 제스처 ─────────────────────────
  {
    id: "wave",
    label: "손 흔들기",
    group: "제스처",
    bones: {
      shoulder_r: [deg(78), 0, deg(-46)],
      elbow_r: [deg(72), 0, 0],
      wrist_r: [0, 0, deg(-16)],
      shoulder_l: [deg(6), 0, deg(6)],
      elbow_l: [deg(14), 0, 0],
      chest: [0, deg(-6), 0],
      head: [deg(-6), deg(8), deg(6)],
    },
  },
  {
    id: "cheer",
    label: "만세",
    group: "제스처",
    bones: {
      shoulder_l: [deg(118), 0, deg(20)],
      shoulder_r: [deg(118), 0, deg(-20)],
      elbow_l: [deg(14), 0, 0],
      elbow_r: [deg(14), 0, 0],
      spine: [deg(-14), 0, 0],
      chest: [deg(-12), 0, 0],
      neck: [deg(-14), 0, 0],
      head: [deg(-16), 0, 0],
    },
  },
  {
    id: "think",
    label: "생각하기",
    group: "제스처",
    bones: {
      shoulder_r: [deg(42), 0, deg(-16)],
      elbow_r: [deg(116), 0, 0],
      wrist_r: [deg(16), 0, 0],
      shoulder_l: [deg(16), 0, deg(-18)],
      elbow_l: [deg(78), 0, 0],
      spine: [deg(8), 0, 0],
      chest: [deg(6), 0, 0],
      neck: [deg(12), deg(-10), 0],
      head: [deg(14), deg(-12), deg(8)],
    },
  },
  {
    id: "point",
    label: "가리키기",
    group: "제스처",
    bones: {
      shoulder_r: [deg(82), 0, deg(-10)],
      elbow_r: [deg(10), 0, 0],
      finger1_r1: [deg(-10), 0, 0],
      finger2_r1: [deg(74), 0, 0],
      finger2_r2: [deg(66), 0, 0],
      shoulder_l: [deg(8), 0, deg(6)],
      elbow_l: [deg(18), 0, 0],
      spine: [0, deg(-12), 0],
      chest: [0, deg(-10), 0],
      head: [0, deg(-8), 0],
    },
  },
  {
    id: "bow_greet",
    label: "인사",
    group: "제스처",
    bones: {
      spine: [deg(30), 0, 0],
      chest: [deg(24), 0, 0],
      neck: [deg(18), 0, 0],
      head: [deg(16), 0, 0],
      shoulder_l: [deg(16), 0, deg(-10)],
      shoulder_r: [deg(16), 0, deg(10)],
      elbow_l: [deg(26), 0, 0],
      elbow_r: [deg(26), 0, 0],
      hip_l: [deg(-6), 0, deg(4)],
      hip_r: [deg(-6), 0, deg(-4)],
    },
  },
  {
    id: "clap",
    label: "박수",
    group: "제스처",
    bones: {
      shoulder_l: [deg(52), 0, deg(-24)],
      shoulder_r: [deg(52), 0, deg(24)],
      elbow_l: [deg(88), 0, 0],
      elbow_r: [deg(88), 0, 0],
      chest: [deg(4), 0, 0],
      head: [deg(-6), 0, 0],
    },
  },
  {
    id: "salute",
    label: "경례",
    group: "제스처",
    bones: {
      shoulder_r: [deg(58), 0, deg(-38)],
      elbow_r: [deg(112), 0, 0],
      wrist_r: [0, 0, deg(-14)],
      shoulder_l: [0, 0, deg(-6)],
      elbow_l: [deg(4), 0, 0],
      spine: [deg(-6), 0, 0],
      chest: [deg(-6), 0, 0],
      head: [deg(-6), 0, 0],
    },
  },
  {
    id: "shrug",
    label: "어깨 으쓱",
    group: "제스처",
    bones: {
      shoulder_l: [deg(20), 0, deg(50)],
      shoulder_r: [deg(20), 0, deg(-50)],
      elbow_l: [deg(84), 0, 0],
      elbow_r: [deg(84), 0, 0],
      wrist_l: [deg(-22), 0, 0],
      wrist_r: [deg(-22), 0, 0],
      neck: [deg(10), 0, 0],
      head: [deg(8), 0, deg(8)],
    },
  },

  // ───────────────────────── 일상 ─────────────────────────
  {
    id: "stretch",
    label: "기지개",
    group: "일상",
    bones: {
      shoulder_l: [deg(116), 0, deg(24)],
      shoulder_r: [deg(116), 0, deg(-24)],
      elbow_l: [deg(28), 0, 0],
      elbow_r: [deg(28), 0, 0],
      spine: [deg(-24), 0, 0],
      chest: [deg(-20), 0, 0],
      neck: [deg(-22), 0, 0],
      head: [deg(-20), 0, 0],
      hip_l: [deg(-8), 0, deg(6)],
      hip_r: [deg(-8), 0, deg(-6)],
    },
  },
  {
    id: "selfie",
    label: "셀카",
    group: "일상",
    bones: {
      shoulder_r: [deg(92), 0, deg(-34)],
      elbow_r: [deg(52), 0, 0],
      wrist_r: [deg(-18), 0, 0],
      shoulder_l: [deg(24), 0, deg(24)],
      elbow_l: [deg(62), 0, 0],
      spine: [0, deg(-10), deg(6)],
      chest: [0, deg(-8), deg(4)],
      neck: [deg(-8), deg(-8), 0],
      head: [deg(-10), deg(-10), deg(12)],
    },
  },
  {
    id: "read",
    label: "독서",
    group: "일상",
    bones: {
      shoulder_l: [deg(56), 0, deg(-16)],
      shoulder_r: [deg(56), 0, deg(16)],
      elbow_l: [deg(76), 0, 0],
      elbow_r: [deg(76), 0, 0],
      spine: [deg(12), 0, 0],
      chest: [deg(10), 0, 0],
      neck: [deg(24), 0, 0],
      head: [deg(24), 0, 0],
    },
  },
  {
    id: "phone",
    label: "휴대폰 보기",
    group: "일상",
    bones: {
      shoulder_l: [deg(48), 0, deg(-20)],
      elbow_l: [deg(94), 0, 0],
      shoulder_r: [deg(38), 0, deg(14)],
      elbow_r: [deg(72), 0, 0],
      spine: [deg(10), 0, 0],
      chest: [deg(8), 0, 0],
      neck: [deg(26), 0, 0],
      head: [deg(26), deg(-6), 0],
    },
  },
  {
    id: "lean_side",
    label: "기대기",
    group: "일상",
    bones: {
      root: [0, 0, deg(14)],
      spine: [0, deg(-8), deg(-12)],
      chest: [0, deg(-6), deg(-8)],
      shoulder_l: [deg(-30), 0, deg(42)],
      elbow_l: [deg(24), 0, 0],
      shoulder_r: [deg(10), 0, deg(-10)],
      elbow_r: [deg(28), 0, 0],
      hip_l: [deg(-4), 0, deg(10)],
      hip_r: [deg(-8), 0, deg(-4)],
      knee_r: [deg(-18), 0, 0],
      head: [0, deg(14), deg(-10)],
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
