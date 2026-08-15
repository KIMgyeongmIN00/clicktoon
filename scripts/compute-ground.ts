/**
 * 프리셋별 접지 높이(Preset.groundY)를 bony.glb에서 계산한다.
 *
 *   npx tsx scripts/compute-ground.ts
 *
 * 왜 필요한가 — 이 리그는 골반 높이가 고정이라 다리를 접어도 몸이 내려오지
 * 않는다. 앉기·무릎 꿇기 자세가 공중에 뜬 것처럼 보이는 이유다. 그래서 자세마다
 * "피규어를 얼마나 내려야 바닥에 닿는가"를 미리 재서 프리셋에 박아 둔다.
 *
 * 방법 — GLB의 노드 계층을 파싱해 각 컨트롤 관절의 rest 자세를 구하고, 프리셋의
 * 회전을 델타로 얹은 뒤 접지 후보 관절(발목·무릎·골반)의 월드 높이를 잰다.
 * 가장 낮은 지점이 y=0에 오도록 하는 값이 groundY다.
 *
 * 자동 접지(런타임에 매번 재는 방식)를 쓰지 않는 이유: 점프처럼 공중에 떠야
 * 하는 자세까지 바닥에 붙어 버린다. 접지 여부는 자세의 의도이지 계산의 결과가
 * 아니므로 프리셋이 직접 갖는다.
 */
import fs from "node:fs";
import * as THREE from "three";
import { PRESETS } from "@/components/pose-editor/presets";
import { CONTROL_BONES } from "@/components/pose-editor/bones";
import { clampRotation } from "@/components/pose-editor/limits";

const GLB = "public/models/bony.glb";
const TARGET_HEIGHT = 1.7; // use-mannequin.ts와 동일해야 한다

// 관절에서 살까지의 두께(앱 단위). 발목은 T-포즈에서 실측하고, 나머지는 추정.
const KNEE_PAD = 0.05;
const HIP_PAD = 0.12;

// ── GLB 파싱 ──
type GltfNode = {
  name?: string;
  children?: number[];
  mesh?: number;
  translation?: number[];
  rotation?: number[];
  scale?: number[];
};
type Gltf = {
  nodes: GltfNode[];
  meshes: { primitives: { attributes: Record<string, number> }[] }[];
  accessors: { min?: number[]; max?: number[] }[];
};

const buf = fs.readFileSync(GLB);
if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error("not a glb");
let off = 12;
let json: Gltf | null = null;
while (off < buf.length) {
  const len = buf.readUInt32LE(off);
  const type = buf.readUInt32LE(off + 4);
  if (type === 0x4e4f534a)
    json = JSON.parse(
      new TextDecoder().decode(buf.subarray(off + 8, off + 8 + len)),
    ) as Gltf;
  off += 8 + len + ((4 - (len % 4)) % 4);
}
if (!json) throw new Error("glb has no JSON chunk");
const gltf = json;
const nodes = gltf.nodes;

const parentOf = new Map<number, number>();
nodes.forEach((n, i) => (n.children ?? []).forEach((c: number) => parentOf.set(c, i)));
const byName = new Map<string, number>();
nodes.forEach((n, i) => n.name && byName.set(n.name, i));

/** 각 노드의 로컬 TRS. 포즈를 얹을 때 rotation만 갈아 끼운다. */
const local = nodes.map((n) => ({
  t: new THREE.Vector3(...(n.translation ?? [0, 0, 0])),
  r: new THREE.Quaternion(...(n.rotation ?? [0, 0, 0, 1])),
  s: new THREE.Vector3(...(n.scale ?? [1, 1, 1])),
  rest: new THREE.Quaternion(...(n.rotation ?? [0, 0, 0, 1])),
}));

const world = new Array<THREE.Matrix4>(nodes.length);
function computeWorld() {
  world.length = 0;
  const m = (i: number): THREE.Matrix4 => {
    if (world[i]) return world[i];
    const lm = new THREE.Matrix4().compose(local[i].t, local[i].r, local[i].s);
    const p = parentOf.get(i);
    world[i] = p === undefined ? lm : m(p).clone().multiply(lm);
    return world[i];
  };
  nodes.forEach((_, i) => m(i));
}
const jointY = (name: string): number | null => {
  const i = byName.get(name);
  if (i === undefined) return null;
  return new THREE.Vector3().setFromMatrixPosition(world[i]).y;
};

// ── 앱과 동일한 스케일/오프셋 (use-mannequin.ts의 bbox 정규화 재현) ──
// glTF accessor의 min/max로 각 메시의 로컬 bbox를 만들고 노드 월드 행렬로 옮긴다.
// three의 Box3.expandByObject과 같은 방식이다.
computeWorld();
const tBox = new THREE.Box3();
for (let i = 0; i < nodes.length; i++) {
  const meshIdx = nodes[i].mesh;
  if (meshIdx === undefined) continue;
  for (const prim of gltf.meshes[meshIdx].primitives) {
    const acc = gltf.accessors[prim.attributes.POSITION];
    if (!acc?.min || !acc?.max) continue;
    const b = new THREE.Box3(
      new THREE.Vector3(...acc.min),
      new THREE.Vector3(...acc.max),
    ).applyMatrix4(world[i]);
    tBox.union(b);
  }
}
const size = new THREE.Vector3();
tBox.getSize(size);
const scale = TARGET_HEIGHT / (Math.max(size.x, size.y, size.z) || 1);
const offsetY = -tBox.min.y * scale;
/** glb 높이 → 피규어 루트 기준 앱 높이 */
const appY = (glbY: number) => offsetY + glbY * scale;

// T-포즈에서 발목 관절이 바닥에서 얼마나 떠 있는가 = 발 두께
const FOOT_PAD = appY(jointY("Bony_lAnkleJ")!);

console.log(`모델 스케일 ${scale.toFixed(4)} · 발 두께 ${FOOT_PAD.toFixed(3)}\n`);

// ── 프리셋별 접지 높이 ──
const JOINT_OF = new Map(CONTROL_BONES.map((b) => [b.name, b.joint]));
const CONTACTS: [string, number][] = [
  ["ankle_l", FOOT_PAD], ["ankle_r", FOOT_PAD],
  ["knee_l", KNEE_PAD], ["knee_r", KNEE_PAD],
  ["root", HIP_PAD],
];

function applyPose(bones: Record<string, [number, number, number]>) {
  // rest로 되돌린 뒤 델타를 얹는다 (앱의 skinned-mannequin과 동일한 규칙)
  local.forEach((l) => l.r.copy(l.rest));
  const e = new THREE.Euler();
  const dq = new THREE.Quaternion();
  for (const cb of CONTROL_BONES) {
    const idx = byName.get(cb.joint);
    if (idx === undefined) continue;
    const rot = clampRotation(cb.name, bones[cb.name] ?? [0, 0, 0]);
    e.set(rot[0], rot[1], rot[2], "XYZ");
    dq.setFromEuler(e);
    local[idx].r.copy(local[idx].rest).multiply(dq);
  }
  computeWorld();
}

const out: { id: string; label: string; groundY: number }[] = [];
for (const p of PRESETS) {
  applyPose(p.bones);
  let lowest = Infinity;
  for (const [bone, pad] of CONTACTS) {
    const j = JOINT_OF.get(bone);
    if (!j) continue;
    const y = jointY(j);
    if (y === null) continue;
    lowest = Math.min(lowest, appY(y) - pad);
  }
  const groundY = -lowest;
  out.push({ id: p.id, label: p.label, groundY });
}

console.log("id                label            groundY");
console.log("─".repeat(50));
for (const r of out) {
  const flag = Math.abs(r.groundY) < 0.02 ? "" : "  ← 내려야 함";
  console.log(
    `${r.id.padEnd(18)}${r.label.padEnd(16)}${r.groundY >= 0 ? " " : ""}${r.groundY.toFixed(3)}${flag}`,
  );
}
console.log("\n프리셋에 넣을 값 (|groundY| ≥ 0.02 만):");
for (const r of out) {
  if (Math.abs(r.groundY) >= 0.02)
    console.log(`  ${r.id}: groundY: ${r.groundY.toFixed(2)},`);
}
