// Control bones for the Bony rig (bony.glb). Each maps to a real deform joint
// node name inside the glb. Rotations are applied as a DELTA on top of each
// joint's rest orientation.

export type ControlBone = {
  name: string; // our control id (used in pose.bones, LIMITS, presets)
  label: string;
  group: string; // UI grouping
  joint: string; // Bony_* node name in the glb
};

export const GROUPS = [
  "몸통",
  "왼팔",
  "왼손",
  "오른팔",
  "오른손",
  "왼다리",
  "오른다리",
] as const;

export const CONTROL_BONES: ControlBone[] = [
  // 몸통
  { name: "root", label: "엉덩이", group: "몸통", joint: "Bony_ROOTJ" },
  { name: "spine", label: "허리", group: "몸통", joint: "Bony_spine02J" },
  { name: "chest", label: "가슴", group: "몸통", joint: "Bony_Spine04J" },
  { name: "neck", label: "목", group: "몸통", joint: "Bony_Neck01J" },
  { name: "head", label: "머리", group: "몸통", joint: "Bony_HeadJ" },

  // 왼팔
  { name: "shoulder_l", label: "어깨", group: "왼팔", joint: "Bony_lShoulderJ" },
  { name: "elbow_l", label: "팔꿈치", group: "왼팔", joint: "Bony_lElbowJ" },
  { name: "wrist_l", label: "손목", group: "왼팔", joint: "Bony_lWristJ" },

  // 왼손
  { name: "thumb_l1", label: "엄지1", group: "왼손", joint: "Bony_lThumbJ1" },
  { name: "thumb_l2", label: "엄지2", group: "왼손", joint: "Bony_lThumbJ2" },
  { name: "thumb_l3", label: "엄지3", group: "왼손", joint: "Bony_lThumbJ3" },
  { name: "finger1_l1", label: "검지1", group: "왼손", joint: "Bony_lFinger1J1" },
  { name: "finger1_l2", label: "검지2", group: "왼손", joint: "Bony_lFinger1J2" },
  { name: "finger1_l3", label: "검지3", group: "왼손", joint: "Bony_lFinger1J3" },
  { name: "finger2_l1", label: "중지1", group: "왼손", joint: "Bony_lFinger2J1" },
  { name: "finger2_l2", label: "중지2", group: "왼손", joint: "Bony_lFinger2J2" },
  { name: "finger2_l3", label: "중지3", group: "왼손", joint: "Bony_lFinger2J3" },

  // 오른팔
  { name: "shoulder_r", label: "어깨", group: "오른팔", joint: "Bony_rShoulderJ" },
  { name: "elbow_r", label: "팔꿈치", group: "오른팔", joint: "Bony_rElbowJ" },
  { name: "wrist_r", label: "손목", group: "오른팔", joint: "Bony_rWristJ" },

  // 오른손
  { name: "thumb_r1", label: "엄지1", group: "오른손", joint: "Bony_rThumbJ1" },
  { name: "thumb_r2", label: "엄지2", group: "오른손", joint: "Bony_rThumbJ2" },
  { name: "thumb_r3", label: "엄지3", group: "오른손", joint: "Bony_rThumbJ3" },
  { name: "finger1_r1", label: "검지1", group: "오른손", joint: "Bony_rFinger1J1" },
  { name: "finger1_r2", label: "검지2", group: "오른손", joint: "Bony_rFinger1J2" },
  { name: "finger1_r3", label: "검지3", group: "오른손", joint: "Bony_rFinger1J3" },
  { name: "finger2_r1", label: "중지1", group: "오른손", joint: "Bony_rFinger2J1" },
  { name: "finger2_r2", label: "중지2", group: "오른손", joint: "Bony_rFinger2J2" },
  { name: "finger2_r3", label: "중지3", group: "오른손", joint: "Bony_rFinger2J3" },

  // 왼다리
  { name: "hip_l", label: "골반", group: "왼다리", joint: "Bony_lHipJ" },
  { name: "knee_l", label: "무릎", group: "왼다리", joint: "Bony_lKneeJ" },
  { name: "ankle_l", label: "발목", group: "왼다리", joint: "Bony_lAnkleJ" },

  // 오른다리
  { name: "hip_r", label: "골반", group: "오른다리", joint: "Bony_rHipJ" },
  { name: "knee_r", label: "무릎", group: "오른다리", joint: "Bony_rKneeJ" },
  { name: "ankle_r", label: "발목", group: "오른다리", joint: "Bony_rAnkleJ" },
];

export const ALL_BONES = CONTROL_BONES;
export const BONE_LABEL: Record<string, string> = Object.fromEntries(
  CONTROL_BONES.map((b) => [b.name, b.label]),
);
export const BONE_JOINT: Record<string, string> = Object.fromEntries(
  CONTROL_BONES.map((b) => [b.name, b.joint]),
);

export function bonesByGroup(): Record<string, ControlBone[]> {
  const out: Record<string, ControlBone[]> = {};
  for (const g of GROUPS) out[g] = [];
  for (const b of CONTROL_BONES) (out[b.group] ??= []).push(b);
  return out;
}
