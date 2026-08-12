"use client";
import { useEffect, useMemo, useRef } from "react";
import { ThreeEvent, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Figure } from "@/types/pose";
import { MannequinTemplate, useFigureRig } from "./use-mannequin";

// Pickable joint marker radius in FINAL world units (body height ≈ 1.7).
const PICK_WORLD = 0.032;
const PICK_WORLD_FINGER = 0.017;
// Invisible hit-area multiplier — clicks register on a sphere larger than the
// visible dot, so small markers (fingers) are easy to grab.
const HIT_SCALE = 1.8;

function isFinger(name: string): boolean {
  return /^(thumb|finger)/.test(name);
}

export function FigureMannequin({
  figure,
  template,
  isSelected,
  selectedBone,
  boneEditing,
  onSelectFigure,
  onSelectBone,
  registerBone,
  registerFigureRoot,
}: {
  figure: Figure;
  template: MannequinTemplate;
  isSelected: boolean;
  selectedBone: string | null;
  /** 관절 모드일 때만 마커를 띄운다 — 이동/회전 중엔 클릭을 가로채면 안 된다. */
  boneEditing: boolean;
  onSelectFigure: (figureId: string) => void;
  onSelectBone: (figureId: string, bone: string) => void;
  registerBone: (
    figureId: string,
    bone: string,
    obj: THREE.Object3D | null,
  ) => void;
  registerFigureRoot: (figureId: string, obj: THREE.Object3D | null) => void;
}) {
  const rig = useFigureRig(template, figure.id);
  const rootRef = useRef<THREE.Group>(null);

  // Register bones for the external rotate gizmo.
  useEffect(() => {
    const { boneMap } = rig;
    boneMap.forEach((node, name) => registerBone(figure.id, name, node));
    return () => {
      boneMap.forEach((_, name) => registerBone(figure.id, name, null));
    };
  }, [rig, figure.id, registerBone]);

  // 피규어 루트를 등록 — 이동/회전 기즈모가 여기에 붙는다.
  useEffect(() => {
    registerFigureRoot(figure.id, rootRef.current);
    return () => registerFigureRoot(figure.id, null);
  }, [figure.id, registerFigureRoot]);

  // Drive bone rotations as a delta on top of each joint's rest orientation.
  useEffect(() => {
    const e = new THREE.Euler();
    const dq = new THREE.Quaternion();
    rig.boneMap.forEach((node, name) => {
      const rest = rig.restQuats.get(name)!;
      const rot = figure.bones[name] ?? [0, 0, 0];
      e.set(rot[0], rot[1], rot[2], "XYZ");
      dq.setFromEuler(e);
      node.quaternion.copy(rest).multiply(dq);
    });
  }, [figure.bones, rig]);

  // Clicking the body mesh must NOT count as an empty-space "miss" (which would
  // clear the selection via the Canvas onPointerMissed). Swallow it.
  function handleBodyPointerDown(e: ThreeEvent<PointerEvent>) {
    e.stopPropagation();
    // 다른 피규어의 몸을 클릭하면 선택을 그쪽으로 옮긴다. 이미 선택된 피규어면
    // 아무것도 하지 않는다 — 몸통을 스쳤다고 관절 선택이 풀리면 안 되므로.
    if (!isSelected) onSelectFigure(figure.id);
  }

  function handleJointPointerDown(e: ThreeEvent<PointerEvent>) {
    const name = (e.object as THREE.Object3D)?.userData?.controlName as
      | string
      | undefined;
    if (!name) return;
    e.stopPropagation();
    onSelectBone(figure.id, name);
  }

  return (
    <>
      {/* 바깥 그룹 = 피규어의 장면 내 배치. 기즈모가 이 오브젝트에 직접 붙으므로
          position/rotation.y를 그대로 읽고 쓸 수 있다(오프셋 역산 불필요).
          안쪽 그룹의 오프셋도 같은 배율로 스케일되어, scale이 얼마든 발은
          항상 figure.position.y에 붙는다. */}
      <group
        ref={rootRef}
        position={figure.position}
        rotation={[0, figure.rotationY, 0]}
        scale={figure.scale}
      >
        <group
          position={template.offset}
          scale={template.scale}
          onPointerDown={handleBodyPointerDown}
        >
          <primitive object={rig.scene} />
        </group>
      </group>

      {/* 관절 마커는 선택된 피규어에만 — 3체 × 37개를 전부 띄우면 화면이
          마커로 뒤덮이고 서로를 가려 클릭이 불가능해진다. */}
      {isSelected && boneEditing && (
        <JointPickers
          boneMap={rig.boneMap}
          selected={selectedBone}
          onPointerDown={handleJointPointerDown}
        />
      )}
    </>
  );
}

// Joint markers rendered in world space (not inside the scaled rig group), so
// their size is a constant regardless of model scale. Positions are synced each
// frame from each control bone's world position.
function JointPickers({
  boneMap,
  selected,
  onPointerDown,
}: {
  boneMap: Map<string, THREE.Object3D>;
  selected: string | null;
  onPointerDown: (e: ThreeEvent<PointerEvent>) => void;
}) {
  const names = useMemo(() => Array.from(boneMap.keys()), [boneMap]);
  const refs = useRef(new Map<string, THREE.Object3D>());
  const tmp = useMemo(() => new THREE.Vector3(), []);
  const tmpDir = useMemo(() => new THREE.Vector3(), []);

  // Place each marker slightly IN FRONT of its joint (toward the camera) so it
  // is always the closest raycast hit — otherwise the body mesh surface sits
  // between the camera and the joint center and swallows the click. Offset is
  // proportional to camera distance so it stays visually attached when zoomed.
  useFrame((state) => {
    boneMap.forEach((bone, name) => {
      const m = refs.current.get(name);
      if (!m) return;
      bone.getWorldPosition(tmp);
      const dist = state.camera.position.distanceTo(tmp);
      tmpDir.copy(state.camera.position).sub(tmp).normalize();
      tmp.addScaledVector(tmpDir, dist * 0.04);
      m.position.copy(tmp);
    });
  });

  return (
    <group userData={{ captureHide: true }}>
      {names.map((name) => {
        const r = isFinger(name) ? PICK_WORLD_FINGER : PICK_WORLD;
        return (
          <group
            key={name}
            ref={(g) => {
              if (g) refs.current.set(name, g);
              else refs.current.delete(name);
            }}
          >
            {/* Large invisible hit area for reliable clicking */}
            <mesh
              userData={{ controlName: name }}
              onPointerDown={onPointerDown}
            >
              <sphereGeometry args={[r * HIT_SCALE, 8, 6]} />
              <meshBasicMaterial visible={false} depthTest={false} />
            </mesh>
            {/* Visible marker */}
            <mesh
              renderOrder={4}
              userData={{ controlName: name }}
              onPointerDown={onPointerDown}
            >
              <sphereGeometry args={[r, 14, 10]} />
              <meshBasicMaterial
                color={selected === name ? "#fbbf24" : "#8b5cf6"}
                depthTest={false}
                transparent
                opacity={selected === name ? 1 : 0.85}
              />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}
