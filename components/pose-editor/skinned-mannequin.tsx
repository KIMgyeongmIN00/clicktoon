"use client";
import { useEffect, useMemo, useRef } from "react";
import { useGLTF } from "@react-three/drei";
import { ThreeEvent, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { CONTROL_BONES } from "./bones";

const MODEL_URL = "/models/bony.glb";
useGLTF.preload(MODEL_URL);

const TARGET_HEIGHT = 1.7;
// Rotate the model about Y so it faces the camera (camera sits at +Z).
const FACE_Y = 0;
// Pickable joint marker radius in FINAL world units (body height ≈ 1.7).
const PICK_WORLD = 0.032;
const PICK_WORLD_FINGER = 0.017;
// Invisible hit-area multiplier — clicks register on a sphere larger than the
// visible dot, so small markers (fingers) are easy to grab.
const HIT_SCALE = 1.8;

function isFinger(name: string): boolean {
  return /^(thumb|finger)/.test(name);
}

type Rig = {
  scene: THREE.Object3D;
  scale: number;
  position: [number, number, number];
  boneMap: Map<string, THREE.Object3D>;
  restQuats: Map<string, THREE.Quaternion>;
};

export function SkinnedMannequin({
  bones: poseBones,
  selected,
  onSelect,
  registerBone,
  rootPosition,
}: {
  bones: Record<string, [number, number, number]>;
  selected: string | null;
  onSelect: (name: string) => void;
  registerBone: (name: string, obj: THREE.Object3D | null) => void;
  rootPosition: [number, number, number];
}) {
  const gltf = useGLTF(MODEL_URL);

  const rig = useMemo<Rig>(() => {
    const scene = gltf.scene;
    scene.rotation.set(0, FACE_Y, 0);

    // Replace all imported materials with a single flat matte material so the
    // model just reads as light/dark by the light direction — no shiny specular
    // blotches or baked textures fighting readability. DoubleSide + recomputed
    // normals fix dark patches caused by inverted/inconsistent normals.
    const matte = new THREE.MeshStandardMaterial({
      color: "#cfd2d6",
      roughness: 1,
      metalness: 0,
      flatShading: false,
      side: THREE.DoubleSide,
    });
    scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.material = matte;
        mesh.castShadow = true;
        mesh.receiveShadow = false;
        mesh.geometry?.computeVertexNormals();
      }
    });

    scene.updateMatrixWorld(true);

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
      const child = scene.getObjectByName(childName);
      const parentNode = scene.getObjectByName(parentName);
      if (child && parentNode) parentNode.attach(child);
    }
    scene.updateMatrixWorld(true);

    const box = new THREE.Box3().setFromObject(scene);
    const size = new THREE.Vector3();
    box.getSize(size);
    const tallest = Math.max(size.x, size.y, size.z) || 1;
    const scale = TARGET_HEIGHT / tallest;
    const center = new THREE.Vector3();
    box.getCenter(center);
    const position: [number, number, number] = [
      -center.x * scale,
      -box.min.y * scale,
      -center.z * scale,
    ];

    const boneMap = new Map<string, THREE.Object3D>();
    const restQuats = new Map<string, THREE.Quaternion>();
    for (const cb of CONTROL_BONES) {
      const node = scene.getObjectByName(cb.joint);
      if (node) {
        boneMap.set(cb.name, node);
        restQuats.set(cb.name, node.quaternion.clone());
        node.userData.restQuat = node.quaternion.clone();
        node.userData.controlName = cb.name;
      }
    }

    return { scene, scale, position, boneMap, restQuats };
  }, [gltf.scene]);

  // Register bones for the external rotate gizmo.
  useEffect(() => {
    rig.boneMap.forEach((node, name) => registerBone(name, node));
    return () => {
      rig.boneMap.forEach((_, name) => registerBone(name, null));
    };
  }, [rig, registerBone]);

  // Drive bone rotations as a delta on top of each joint's rest orientation.
  useEffect(() => {
    const e = new THREE.Euler();
    const dq = new THREE.Quaternion();
    rig.boneMap.forEach((node, name) => {
      const rest = rig.restQuats.get(name)!;
      const rot = poseBones[name] ?? [0, 0, 0];
      e.set(rot[0], rot[1], rot[2], "XYZ");
      dq.setFromEuler(e);
      node.quaternion.copy(rest).multiply(dq);
    });
  }, [poseBones, rig]);

  function handlePointerDown(e: ThreeEvent<PointerEvent>) {
    const name = (e.object as THREE.Object3D)?.userData?.controlName as
      | string
      | undefined;
    if (name) {
      e.stopPropagation();
      onSelect(name);
    }
  }

  const groupPos: [number, number, number] = [
    rootPosition[0] + rig.position[0],
    rootPosition[1] + rig.position[1],
    rootPosition[2] + rig.position[2],
  ];

  // Clicking the body mesh must NOT count as an empty-space "miss" (which would
  // clear the selection via the Canvas onPointerMissed). Swallow it so the
  // current joint selection is preserved; only true background clicks deselect.
  function handleBodyPointerDown(e: ThreeEvent<PointerEvent>) {
    e.stopPropagation();
  }

  return (
    <>
      <group
        position={groupPos}
        scale={rig.scale}
        onPointerDown={handleBodyPointerDown}
      >
        <primitive object={rig.scene} />
      </group>
      <JointPickers
        boneMap={rig.boneMap}
        selected={selected}
        onPointerDown={handlePointerDown}
      />
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
