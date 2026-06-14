"use client";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, TransformControls, Grid } from "@react-three/drei";
import * as THREE from "three";
import { SkinnedMannequin } from "./skinned-mannequin";
import { PoseState, light2dToScenePosition } from "@/types/pose";

type Props = {
  pose: PoseState;
  selected: string | null;
  onSelect: (name: string | null) => void;
  onRotate: (name: string, rot: [number, number, number]) => void;
  registerCapture: (fn: () => string) => void;
};

export function PoseScene({
  pose,
  selected,
  onSelect,
  onRotate,
  registerCapture,
}: Props) {
  const boneRefs = useRef(new Map<string, THREE.Object3D>());

  const registerBone = useCallback((name: string, obj: THREE.Object3D | null) => {
    if (obj) boneRefs.current.set(name, obj);
    else boneRefs.current.delete(name);
  }, []);

  const lightPos = light2dToScenePosition(pose.light2d);

  return (
    <Canvas
      shadows={{ type: THREE.PCFShadowMap }}
      gl={{ preserveDrawingBuffer: true, antialias: true }}
      camera={{ position: pose.camera.position, fov: pose.camera.fov }}
      onPointerMissed={() => onSelect(null)}
    >
      <CaptureBinder registerCapture={registerCapture} />
      <color attach="background" args={["#0b0b0d"]} />
      {/* Soft, even base so no part of the matte model reads as pure black */}
      <hemisphereLight args={["#ffffff", "#3a3a44", 0.85]} />
      <ambientLight intensity={0.25} />
      {/* Key light follows the 2D light control */}
      <directionalLight
        position={lightPos}
        intensity={pose.light2d.intensity}
        color={pose.light2d.color}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      {/* Gentle fill from the opposite side for readability */}
      <directionalLight
        position={[-lightPos[0], lightPos[1] * 0.5 + 1, -lightPos[2]]}
        intensity={0.35}
      />

      {/* Large white floor that extends to the horizon so the grid always
          sits on solid ground, never cut off. */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.002, 0]}
        receiveShadow
      >
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color="#ffffff" roughness={1} metalness={0} />
      </mesh>

      <Grid
        position={[0, 0, 0]}
        args={[12, 12]}
        cellSize={0.25}
        cellThickness={0.8}
        sectionSize={1}
        sectionThickness={1.6}
        sectionColor="#6b7280"
        cellColor="#b0b4bd"
        fadeDistance={40}
        fadeStrength={1.5}
        infiniteGrid
      />

      <Suspense fallback={null}>
        <SkinnedMannequin
          selected={selected}
          onSelect={onSelect}
          registerBone={registerBone}
          bones={pose.bones}
          rootPosition={pose.rootPosition}
        />
      </Suspense>

      <BoneRotateGizmo
        selected={selected}
        boneRefs={boneRefs}
        onRotate={onRotate}
      />

      <OrbitControls
        makeDefault
        enableDamping
        target={pose.camera.target}
      />
    </Canvas>
  );
}

function CaptureBinder({
  registerCapture,
}: {
  registerCapture: (fn: () => string) => void;
}) {
  const { gl, scene, camera } = useThree();
  useEffect(() => {
    registerCapture(() => {
      // Temporarily hide editor-only overlays (joint markers, rotate gizmo)
      // so they never appear in the captured / generated image. Restore after.
      const hidden: THREE.Object3D[] = [];
      scene.traverse((o) => {
        const g = o as {
          isTransformControlsRoot?: boolean;
          isTransformControlsGizmo?: boolean;
        };
        const isGizmo =
          g.isTransformControlsRoot === true ||
          g.isTransformControlsGizmo === true;
        if ((o.userData?.captureHide || isGizmo) && o.visible) {
          o.visible = false;
          hidden.push(o);
        }
      });
      gl.render(scene, camera);
      const url = gl.domElement.toDataURL("image/png");
      for (const o of hidden) o.visible = true;
      return url;
    });
  }, [gl, scene, camera, registerCapture]);
  return null;
}

function BoneRotateGizmo({
  selected,
  boneRefs,
  onRotate,
}: {
  selected: string | null;
  boneRefs: React.RefObject<Map<string, THREE.Object3D>>;
  onRotate: (name: string, rot: [number, number, number]) => void;
}) {
  const [bone, setBone] = useState<THREE.Object3D | null>(null);

  useEffect(() => {
    if (!selected) {
      setBone(null);
      return;
    }
    const handle = requestAnimationFrame(() => {
      const found = boneRefs.current?.get(selected) ?? null;
      setBone(found);
    });
    return () => cancelAnimationFrame(handle);
  }, [selected, boneRefs]);

  if (!selected || !bone) return null;

  return (
    <TransformControls
      object={bone}
      mode="rotate"
      space="local"
      size={0.7}
      onObjectChange={() => {
        // Free 3D rotation: read the bone's current delta from its rest pose and
        // store it as-is. We do NOT clamp or re-apply the quaternion here —
        // doing so forced a quaternion→Euler→quaternion round trip that snapped
        // the rotation at gimbal-lock and bent it onto the wrong axis. Per-axis
        // human limits are applied only on the slider path (BonePanel).
        const rest = bone.userData.restQuat as THREE.Quaternion | undefined;
        if (!rest) {
          onRotate(selected, [
            bone.rotation.x,
            bone.rotation.y,
            bone.rotation.z,
          ]);
          return;
        }
        const deltaQ = rest.clone().invert().multiply(bone.quaternion);
        const e = new THREE.Euler().setFromQuaternion(deltaQ, "XYZ");
        onRotate(selected, [e.x, e.y, e.z]);
      }}
    />
  );
}
