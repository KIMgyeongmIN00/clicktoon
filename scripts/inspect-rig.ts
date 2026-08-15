/**
 * bony.glb의 스킨 구조를 들여다본다. 상체가 굽혀지지 않는 원인을 찾기 위한 도구.
 *   npx tsx scripts/inspect-rig.ts
 *
 * 확인하는 것:
 *  1) 전체 관절 이름과 계층 (spine 계열이 어디에 붙어 있는가)
 *  2) 몸통 정점들이 실제로 어느 관절에 가중치를 갖는가
 *  3) 그 관절이 spine02J의 자손인가 (아니면 회전이 전달되지 않는다)
 */
import fs from "node:fs";
import * as THREE from "three";

const GLB = "public/models/bony.glb";

type GltfNode = {
  name?: string;
  children?: number[];
  mesh?: number;
  skin?: number;
  translation?: number[];
  rotation?: number[];
  scale?: number[];
};
type Accessor = {
  bufferView?: number;
  byteOffset?: number;
  componentType: number;
  count: number;
  type: string;
  min?: number[];
  max?: number[];
};
type Gltf = {
  nodes: GltfNode[];
  meshes: { name?: string; primitives: { attributes: Record<string, number> }[] }[];
  skins?: { joints: number[]; skeleton?: number }[];
  accessors: Accessor[];
  bufferViews: { buffer: number; byteOffset?: number; byteLength: number; byteStride?: number }[];
};

// ── GLB ──
const buf = fs.readFileSync(GLB);
let off = 12;
let json: Gltf | null = null;
let bin: Buffer | null = null;
while (off < buf.length) {
  const len = buf.readUInt32LE(off);
  const type = buf.readUInt32LE(off + 4);
  const chunk = buf.subarray(off + 8, off + 8 + len);
  if (type === 0x4e4f534a) json = JSON.parse(new TextDecoder().decode(chunk)) as Gltf;
  if (type === 0x004e4942) bin = Buffer.from(chunk);
  off += 8 + len + ((4 - (len % 4)) % 4);
}
if (!json || !bin) throw new Error("glb parse failed");
const g = json;
const B = bin;

const COMP: Record<number, { size: number; read: (b: Buffer, o: number) => number }> = {
  5120: { size: 1, read: (b, o) => b.readInt8(o) },
  5121: { size: 1, read: (b, o) => b.readUInt8(o) },
  5122: { size: 2, read: (b, o) => b.readInt16LE(o) },
  5123: { size: 2, read: (b, o) => b.readUInt16LE(o) },
  5125: { size: 4, read: (b, o) => b.readUInt32LE(o) },
  5126: { size: 4, read: (b, o) => b.readFloatLE(o) },
};
const NCOMP: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };

function readAccessor(idx: number): number[][] {
  const a = g.accessors[idx];
  const bv = g.bufferViews[a.bufferView!];
  const c = COMP[a.componentType];
  const n = NCOMP[a.type];
  const stride = bv.byteStride ?? c.size * n;
  const base = (bv.byteOffset ?? 0) + (a.byteOffset ?? 0);
  const out: number[][] = [];
  for (let i = 0; i < a.count; i++) {
    const row: number[] = [];
    for (let k = 0; k < n; k++) row.push(c.read(B, base + i * stride + k * c.size));
    out.push(row);
  }
  return out;
}

const nodes = g.nodes;
const parentOf = new Map<number, number>();
nodes.forEach((n, i) => (n.children ?? []).forEach((c) => parentOf.set(c, i)));
const nameOf = (i: number) => nodes[i].name ?? `#${i}`;
const isDescendantOf = (i: number, ancestor: number) => {
  let p = parentOf.get(i);
  while (p !== undefined) {
    if (p === ancestor) return true;
    p = parentOf.get(p);
  }
  return false;
};

// 월드 행렬 (정점 높이 판정용)
const world: THREE.Matrix4[] = [];
const localMat = nodes.map((n) => {
  const t = new THREE.Vector3(...(n.translation ?? [0, 0, 0]));
  const r = new THREE.Quaternion(...(n.rotation ?? [0, 0, 0, 1]));
  const s = new THREE.Vector3(...(n.scale ?? [1, 1, 1]));
  return new THREE.Matrix4().compose(t, r, s);
});
(function computeWorld() {
  const m = (i: number): THREE.Matrix4 => {
    if (world[i]) return world[i];
    const p = parentOf.get(i);
    world[i] = p === undefined ? localMat[i].clone() : m(p).clone().multiply(localMat[i]);
    return world[i];
  };
  nodes.forEach((_, i) => m(i));
})();

console.log("\n═══ 1. spine / torso 관련 관절과 부모 ═══");
nodes.forEach((n, i) => {
  if (!n.name) return;
  if (!/spine|Spine|chest|Chest|Neck|Torso|Belly|Abdo|ROOT|Hip(?!.*Curve)/.test(n.name)) return;
  const p = parentOf.get(i);
  console.log(`  ${n.name.padEnd(28)} ← ${p === undefined ? "(root)" : nameOf(p)}`);
});

console.log("\n═══ 2. 이름에 Curve가 든 관절 중 몸통 계열 ═══");
const curves = nodes
  .map((n, i) => ({ n, i }))
  .filter((x) => x.n.name && /Curve/i.test(x.n.name));
console.log(`  전체 Curve 관절 ${curves.length}개`);
for (const { n, i } of curves) {
  if (/Spine|spine|Chest|Neck|Torso|Belly/i.test(n.name!))
    console.log(`  ${n.name!.padEnd(28)} ← ${nameOf(parentOf.get(i)!)}`);
}

// ── 스킨 가중치 분석 ──
const skinNodeIdx = nodes.findIndex((n) => n.skin !== undefined && n.mesh !== undefined);
if (skinNodeIdx < 0) { console.log("\n스킨드 메시 없음"); process.exit(0); }
const skin = g.skins![nodes[skinNodeIdx].skin!];
const meshIdx = nodes[skinNodeIdx].mesh!;

const spine02 = nodes.findIndex((n) => n.name === "Bony_spine02J");
const chest04 = nodes.findIndex((n) => n.name === "Bony_Spine04J");

console.log("\n═══ 3. 몸통 정점이 실제로 쓰는 관절 ═══");
console.log("   (가슴~배 높이 정점만 골라 가중치 합산)");

// 몸통 높이대 판정용: 골반~목 사이
const rootY = new THREE.Vector3().setFromMatrixPosition(world[nodes.findIndex((n) => n.name === "Bony_ROOTJ")]).y;
const neckY = new THREE.Vector3().setFromMatrixPosition(world[nodes.findIndex((n) => n.name === "Bony_Neck01J")]).y;

const totals = new Map<number, number>();
let torsoVerts = 0;
for (const prim of g.meshes[meshIdx].primitives) {
  const pos = readAccessor(prim.attributes.POSITION);
  const jnt = readAccessor(prim.attributes.JOINTS_0);
  const wgt = readAccessor(prim.attributes.WEIGHTS_0);
  const nodeWorld = world[skinNodeIdx];
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.length; i++) {
    v.set(pos[i][0], pos[i][1], pos[i][2]).applyMatrix4(nodeWorld);
    if (v.y < rootY || v.y > neckY) continue; // 몸통 높이대만
    torsoVerts++;
    for (let k = 0; k < 4; k++) {
      const w = wgt[i][k];
      if (w <= 0.001) continue;
      const jointNode = skin.joints[jnt[i][k]];
      totals.set(jointNode, (totals.get(jointNode) ?? 0) + w);
    }
  }
}
console.log(`   몸통 정점 ${torsoVerts}개\n`);
const ranked = [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
const sum = [...totals.values()].reduce((a, b) => a + b, 0);
console.log("   관절".padEnd(32) + "가중치 비율   spine02J 자손?");
console.log("   " + "─".repeat(62));
for (const [nodeIdx, w] of ranked) {
  const pct = ((w / sum) * 100).toFixed(1);
  const underSpine =
    nodeIdx === spine02 || isDescendantOf(nodeIdx, spine02) ? "예" : "❌ 아니오";
  console.log(`   ${nameOf(nodeIdx).padEnd(30)}${pct.padStart(6)}%      ${underSpine}`);
}

const notUnder = ranked.filter(
  ([i]) => !(i === spine02 || isDescendantOf(i, spine02)),
);
console.log("\n═══ 결론 ═══");
if (notUnder.length === 0) {
  console.log("  몸통 가중치가 전부 spine02J 아래에 있다 → 회전이 전달돼야 정상.");
} else {
  console.log("  spine02J 밖에 있는 관절이 몸통을 잡고 있다 → 회전이 전달되지 않는다.");
  console.log("  재부모화 후보:");
  for (const [i, w] of notUnder)
    console.log(`    ${nameOf(i)}  (${((w / sum) * 100).toFixed(1)}%)  현재 부모: ${nameOf(parentOf.get(i) ?? -1)}`);
}
console.log(`\n  참고: chest(Bony_Spine04J)는 spine02J의 ${chest04 >= 0 && isDescendantOf(chest04, spine02) ? "자손" : "자손이 아님"}`);

console.log("\n═══ 4. 주요 관절의 부모 (체인 연결 상태) ═══");
for (const nm of [
  "Bony_ROOTJ", "Bony_spine01J", "Bony_spine02J", "Bony_spine03J",
  "Bony_Spine04J", "Bony_Neck01J", "Bony_Neck02J", "Bony_HeadJ",
  "Bony_lShoulderJ", "Bony_rShoulderJ", "Bony_lElbowJ", "Bony_lHipJ",
]) {
  const i = nodes.findIndex((n) => n.name === nm);
  if (i < 0) { console.log(`  ${nm.padEnd(20)} (없음)`); continue; }
  const p = parentOf.get(i);
  console.log(`  ${nm.padEnd(20)} ← ${p === undefined ? "(root)" : nameOf(p)}`);
}

console.log("\n═══ 5. 머리·팔 정점은 어느 관절에 걸려 있나 ═══");
for (const [label, test] of [
  ["머리", (v: THREE.Vector3) => v.y > neckY],
] as [string, (v: THREE.Vector3) => boolean][]) {
  const t = new Map<number, number>();
  for (const prim of g.meshes[meshIdx].primitives) {
    const pos = readAccessor(prim.attributes.POSITION);
    const jnt = readAccessor(prim.attributes.JOINTS_0);
    const wgt = readAccessor(prim.attributes.WEIGHTS_0);
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.length; i++) {
      v.set(pos[i][0], pos[i][1], pos[i][2]).applyMatrix4(world[skinNodeIdx]);
      if (!test(v)) continue;
      for (let k = 0; k < 4; k++) {
        if (wgt[i][k] <= 0.001) continue;
        const jn = skin.joints[jnt[i][k]];
        t.set(jn, (t.get(jn) ?? 0) + wgt[i][k]);
      }
    }
  }
  const s = [...t.values()].reduce((a, b) => a + b, 0);
  console.log(`  [${label}]`);
  for (const [i, w] of [...t.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6))
    console.log(`    ${nameOf(i).padEnd(24)}${((w / s) * 100).toFixed(1).padStart(6)}%`);
}
