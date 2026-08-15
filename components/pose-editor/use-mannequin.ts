"use client";
import { useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import { clone as cloneSkinned } from "three/addons/utils/SkeletonUtils.js";
import * as THREE from "three";
import { CONTROL_BONES } from "./bones";

const MODEL_URL = "/models/bony.glb";
useGLTF.preload(MODEL_URL);

const TARGET_HEIGHT = 1.7;
// Rotate the model about Y so it faces the camera (camera sits at +Z).
const FACE_Y = 0;

export type MannequinTemplate = {
  /** 재질 교체·관절 재부모화까지 끝낸 원본. 피규어마다 이걸 clone해서 쓴다. */
  source: THREE.Object3D;
  /** 키를 TARGET_HEIGHT에 맞추는 배율. */
  scale: number;
  /** 발이 y=0에 닿고 좌우/앞뒤 중앙에 서도록 하는 오프셋(scale 반영 완료). */
  offset: [number, number, number];
};

export type FigureRig = {
  scene: THREE.Object3D;
  boneMap: Map<string, THREE.Object3D>;
  restQuats: Map<string, THREE.Quaternion>;
};

// 장면 전체가 공유하는 마네킹 원본을 1회 준비한다.
//
// drei의 useGLTF는 URL당 캐시된 단일 scene을 돌려준다. 그걸 제자리에서 고치면
// 캐시가 오염되고, 무엇보다 <primitive object={...}>로 두 번 마운트하면
// three.js의 add()가 이전 부모에서 오브젝트를 떼어내므로 마네킹이 한 체만
// 렌더된다. 그래서 준비 작업도 clone 위에서 한다.
export function useMannequinTemplate(): MannequinTemplate {
  const gltf = useGLTF(MODEL_URL);

  return useMemo<MannequinTemplate>(() => {
    const source = cloneSkinned(gltf.scene);
    source.rotation.set(0, FACE_Y, 0);

    // Replace all imported materials with a single flat matte material so the
    // model just reads as light/dark by the light direction — no shiny specular
    // blotches or baked textures fighting readability. DoubleSide + recomputed
    // normals fix dark patches caused by inverted/inconsistent normals.
    // 이 재질 인스턴스는 모든 피규어 복제본이 공유한다(clone은 재질을 복제하지
    // 않는다) — 마네킹은 전부 같은 회색이므로 의도된 동작이다.
    const matte = new THREE.MeshStandardMaterial({
      color: "#cfd2d6",
      roughness: 1,
      metalness: 0,
      flatShading: false,
      side: THREE.DoubleSide,
    });
    source.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.material = matte;
        mesh.castShadow = true;
        mesh.receiveShadow = false;
        mesh.geometry?.computeVertexNormals();
      }
    });

    source.updateMatrixWorld(true);

    // The limb meshes are skinned to "curve" deform joints that the original
    // rig drove via constraints (lost in glTF). The curve joints sit flat under
    // the skeleton group with no hierarchy, so rotating a main FK joint does
    // nothing to them. Re-parent each curve joint under its corresponding main
    // joint (attach preserves world transform → bind pose unchanged), so the
    // existing control→main-joint mapping now deforms the limbs.
    const reparent: [string, string][] = [];
    for (const s of ["l", "r"]) {
      reparent.push(
        // Wrist/hand sit on a separate IK branch — bring them onto the arm
        // chain so the hand follows the shoulder/elbow.
        [`Bony_${s}WristJ`, `Bony_${s}ForearmJ`],
        [`Bony_${s}ShoulderCurveJ`, `Bony_${s}ShoulderJ`],
        [`Bony_${s}UpperArmCurveJ1`, `Bony_${s}ShoulderJ`],
        [`Bony_${s}UpperArmCurveJ2`, `Bony_${s}ShoulderJ`],
        [`Bony_${s}UpperArmCurveJ3`, `Bony_${s}ShoulderJ`],
        [`Bony_${s}ElbowCurveJ`, `Bony_${s}ElbowJ`],
        [`Bony_${s}LowerArmCurveJ1`, `Bony_${s}ElbowJ`],
        [`Bony_${s}LowerArmCurveJ2`, `Bony_${s}ElbowJ`],
        [`Bony_${s}LowerArmCurveJ3`, `Bony_${s}ElbowJ`],
        [`Bony_${s}HipCurveJ`, `Bony_${s}HipJ`],
        [`Bony_${s}UpperLegCurveJ1`, `Bony_${s}HipJ`],
        [`Bony_${s}UpperLegCurveJ2`, `Bony_${s}HipJ`],
        [`Bony_${s}UpperLegCurveJ3`, `Bony_${s}HipJ`],
        [`Bony_${s}KneeCurveJ`, `Bony_${s}KneeJ`],
        [`Bony_${s}LowerLegCurveJ1`, `Bony_${s}KneeJ`],
        [`Bony_${s}LowerLegCurveJ2`, `Bony_${s}KneeJ`],
        [`Bony_${s}LowerLegCurveJ3`, `Bony_${s}KneeJ`],
      );
    }
    for (const [childName, parentName] of reparent) {
      const child = source.getObjectByName(childName);
      const parentNode = source.getObjectByName(parentName);
      if (child && parentNode) parentNode.attach(child);
    }
    source.updateMatrixWorld(true);

    const box = new THREE.Box3().setFromObject(source);
    const size = new THREE.Vector3();
    box.getSize(size);
    const tallest = Math.max(size.x, size.y, size.z) || 1;
    const scale = TARGET_HEIGHT / tallest;
    const center = new THREE.Vector3();
    box.getCenter(center);
    const offset: [number, number, number] = [
      -center.x * scale,
      -box.min.y * scale,
      -center.z * scale,
    ];

    return { source, scale, offset };
  }, [gltf.scene]);
}

// 피규어 1체분 독립 리그. 스킨드 메시는 반드시 SkeletonUtils.clone을 써야 한다 —
// 일반 Object3D.clone()은 SkinnedMesh의 스켈레톤 본 참조를 리매핑하지 않아
// 모든 복제본이 원본 스켈레톤을 공유하고, 한 체를 움직이면 전부 같이 움직인다.
// geometry와 material은 복제되지 않고 공유되므로 메모리 비용은 노드 그래프뿐.
export function useFigureRig(
  template: MannequinTemplate,
  figureId: string,
): FigureRig {
  return useMemo<FigureRig>(() => {
    const scene = cloneSkinned(template.source);

    const boneMap = new Map<string, THREE.Object3D>();
    const restQuats = new Map<string, THREE.Quaternion>();
    for (const cb of CONTROL_BONES) {
      const node = scene.getObjectByName(cb.joint);
      if (!node) continue;
      boneMap.set(cb.name, node);
      const rest = node.quaternion.clone();
      restQuats.set(cb.name, rest);
      // userData는 복제 후에 심는다 — Object3D.copy()가 userData를 JSON으로
      // 왕복시키므로 템플릿에 Quaternion을 넣어 두면 복제본에서 평범한
      // {_x,_y,_z,_w} 객체로 뭉개진다.
      node.userData.restQuat = rest;
      node.userData.controlName = cb.name;
      // 히트테스트가 "몇 번 피규어의 관절인지" 구분하는 축.
      node.userData.figureId = figureId;
    }

    return { scene, boneMap, restQuats };
  }, [template.source, figureId]);
}
