"use client";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, TransformControls, Grid } from "@react-three/drei";
import * as THREE from "three";
import { FigureMannequin } from "./figure-mannequin";
import { MannequinTemplate, useMannequinTemplate } from "./use-mannequin";
import {
  Figure,
  FigureLayout,
  FigureMode,
  PoseState,
  Selection,
  light2dToScenePosition,
} from "@/types/pose";

// 캡처 시 피규어의 기준점을 발밑이 아니라 몸통 중앙으로 올린다 — 화면 좌우
// 판정이 안정적이고, 카메라를 내려다보게 두어도 프레임 밖으로 잘 안 나간다.
const BODY_CENTER_Y = 0.85;

export type CaptureResult = { dataUrl: string; layout: FigureLayout[] };

export type FigureTransformPatch = {
  position?: [number, number, number];
  rotationY?: number;
};

type Props = {
  pose: PoseState;
  selection: Selection | null;
  figureMode: FigureMode;
  /** 관절 모드 여부. false면 관절 마커를 띄우지 않는다. */
  boneEditing: boolean;
  onSelect: (sel: Selection | null) => void;
  onRotateBone: (
    figureId: string,
    bone: string,
    rot: [number, number, number],
  ) => void;
  onTransformFigure: (figureId: string, patch: FigureTransformPatch) => void;
  registerCapture: (fn: () => CaptureResult) => void;
};

export function PoseScene({
  pose,
  selection,
  figureMode,
  boneEditing,
  onSelect,
  onRotateBone,
  onTransformFigure,
  registerCapture,
}: Props) {
  // 본 참조는 반드시 피규어별로 네임스페이스를 나눈다 — 본 이름만으로 키를
  // 잡으면 두 피규어의 "head"가 서로를 덮어쓴다.
  const boneRefs = useRef(new Map<string, THREE.Object3D>());
  const figureRefs = useRef(new Map<string, THREE.Object3D>());

  const registerBone = useCallback(
    (figureId: string, bone: string, obj: THREE.Object3D | null) => {
      const key = `${figureId}:${bone}`;
      if (obj) boneRefs.current.set(key, obj);
      else boneRefs.current.delete(key);
    },
    [],
  );

  const registerFigureRoot = useCallback(
    (figureId: string, obj: THREE.Object3D | null) => {
      if (obj) figureRefs.current.set(figureId, obj);
      else figureRefs.current.delete(figureId);
    },
    [],
  );

  const lightPos = light2dToScenePosition(pose.light2d);

  return (
    <Canvas
      shadows={{ type: THREE.PCFShadowMap }}
      gl={{ preserveDrawingBuffer: true, antialias: true }}
      camera={{ position: pose.camera.position, fov: pose.camera.fov }}
      onPointerMissed={() => onSelect(null)}
    >
      <CaptureBinder
        registerCapture={registerCapture}
        figureRefs={figureRefs}
      />
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
        <MannequinFigures
          figures={pose.figures}
          selection={selection}
          boneEditing={boneEditing}
          onSelect={onSelect}
          registerBone={registerBone}
          registerFigureRoot={registerFigureRoot}
        />
      </Suspense>

      <SceneGizmo
        selection={selection}
        figureMode={figureMode}
        boneRefs={boneRefs}
        figureRefs={figureRefs}
        onRotateBone={onRotateBone}
        onTransformFigure={onTransformFigure}
      />

      <OrbitControls makeDefault enableDamping target={pose.camera.target} />
    </Canvas>
  );
}

// useGLTF가 서스펜드하므로 반드시 <Suspense> 안에서 호출돼야 한다. 템플릿은
// 한 번만 준비하고 피규어마다 복제해 쓴다.
function MannequinFigures({
  figures,
  selection,
  boneEditing,
  onSelect,
  registerBone,
  registerFigureRoot,
}: {
  figures: Figure[];
  selection: Selection | null;
  boneEditing: boolean;
  onSelect: (sel: Selection | null) => void;
  registerBone: (
    figureId: string,
    bone: string,
    obj: THREE.Object3D | null,
  ) => void;
  registerFigureRoot: (figureId: string, obj: THREE.Object3D | null) => void;
}) {
  const template: MannequinTemplate = useMannequinTemplate();

  return (
    <>
      {figures.map((f) => (
        <FigureMannequin
          key={f.id}
          figure={f}
          template={template}
          isSelected={selection?.figureId === f.id}
          selectedBone={selection?.figureId === f.id ? selection.bone : null}
          boneEditing={boneEditing}
          onSelectFigure={(id) => onSelect({ figureId: id, bone: null })}
          onSelectBone={(id, bone) => onSelect({ figureId: id, bone })}
          registerBone={registerBone}
          registerFigureRoot={registerFigureRoot}
        />
      ))}
    </>
  );
}

function CaptureBinder({
  registerCapture,
  figureRefs,
}: {
  registerCapture: (fn: () => CaptureResult) => void;
  figureRefs: React.RefObject<Map<string, THREE.Object3D>>;
}) {
  const { gl, scene, camera } = useThree();
  useEffect(() => {
    registerCapture(() => {
      // Temporarily hide editor-only overlays (joint markers, gizmo) so they
      // never appear in the captured / generated image. Restore after.
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
      const dataUrl = gl.domElement.toDataURL("image/png");
      for (const o of hidden) o.visible = true;

      // 픽셀을 뽑은 것과 정확히 같은 카메라 상태에서 피규어 화면 위치를 잰다.
      // 주의: page의 applyDistortion이 이 뒤에 픽셀을 왜곡하므로 좌표가 미세하게
      // 어긋난다 — 좌/중/우 수준의 서술에는 영향이 없다.
      const layout: FigureLayout[] = [];
      const v = new THREE.Vector3();
      figureRefs.current?.forEach((obj, figureId) => {
        obj.getWorldPosition(v);
        v.y += BODY_CENTER_Y * obj.scale.y;
        // project()가 v를 덮어쓰므로 거리를 먼저 잰다.
        const depth = camera.position.distanceTo(v);
        v.project(camera); // → NDC(-1..1)
        layout.push({
          figureId,
          x: (v.x + 1) / 2,
          y: (1 - v.y) / 2,
          depth,
        });
      });

      return { dataUrl, layout };
    });
  }, [gl, scene, camera, registerCapture, figureRefs]);
  return null;
}

// 기즈모는 항상 한 개만 마운트한다 — TransformControls 여러 개가 동시에 붙으면
// makeDefault OrbitControls의 활성/비활성 토글이 서로를 덮어써 카메라가 끊긴다.
function SceneGizmo({
  selection,
  figureMode,
  boneRefs,
  figureRefs,
  onRotateBone,
  onTransformFigure,
}: {
  selection: Selection | null;
  figureMode: FigureMode;
  boneRefs: React.RefObject<Map<string, THREE.Object3D>>;
  figureRefs: React.RefObject<Map<string, THREE.Object3D>>;
  onRotateBone: (
    figureId: string,
    bone: string,
    rot: [number, number, number],
  ) => void;
  onTransformFigure: (figureId: string, patch: FigureTransformPatch) => void;
}) {
  const [target, setTarget] = useState<THREE.Object3D | null>(null);
  const figureId = selection?.figureId ?? null;
  const bone = selection?.bone ?? null;

  useEffect(() => {
    if (!figureId) {
      setTarget(null);
      return;
    }
    // 새로 마운트된 피규어의 ref는 아직 안 채워졌을 수 있으므로 한 프레임 뒤 조회.
    const handle = requestAnimationFrame(() => {
      const found = bone
        ? (boneRefs.current?.get(`${figureId}:${bone}`) ?? null)
        : (figureRefs.current?.get(figureId) ?? null);
      setTarget(found);
    });
    return () => cancelAnimationFrame(handle);
  }, [figureId, bone, boneRefs, figureRefs]);

  if (!figureId || !target) return null;

  if (bone) {
    return (
      <TransformControls
        object={target}
        mode="rotate"
        space="local"
        size={0.7}
        onObjectChange={() => {
          // Free 3D rotation: read the bone's current delta from its rest pose
          // and store it as-is. We do NOT clamp or re-apply the quaternion here —
          // doing so forced a quaternion→Euler→quaternion round trip that snapped
          // the rotation at gimbal-lock and bent it onto the wrong axis. Per-axis
          // human limits are applied only on the slider path (BonePanel).
          const rest = target.userData.restQuat as THREE.Quaternion | undefined;
          if (!rest) {
            onRotateBone(figureId, bone, [
              target.rotation.x,
              target.rotation.y,
              target.rotation.z,
            ]);
            return;
          }
          const deltaQ = rest.clone().invert().multiply(target.quaternion);
          const e = new THREE.Euler().setFromQuaternion(deltaQ, "XYZ");
          onRotateBone(figureId, bone, [e.x, e.y, e.z]);
        }}
      />
    );
  }

  // 피규어 배치. 이동은 바닥면(XZ)만, 회전은 좌우(yaw)만 노출한다 — 마네킹이
  // 공중에 뜨거나 옆으로 누워 버리는 조작을 애초에 막는다.
  const isTranslate = figureMode === "translate";
  return (
    <TransformControls
      object={target}
      mode={isTranslate ? "translate" : "rotate"}
      space={isTranslate ? "world" : "local"}
      size={0.9}
      showX={isTranslate}
      showY={!isTranslate}
      showZ={isTranslate}
      onObjectChange={() => {
        if (isTranslate) {
          // y는 건드리지 않는다 — 기즈모에 Y 핸들이 없기도 하지만, 앉기·무릎
          // 꿇기 프리셋이 넣어 둔 접지 높이를 이동 중에 0으로 되돌리면 안 된다.
          onTransformFigure(figureId, {
            position: [
              target.position.x,
              target.position.y,
              target.position.z,
            ],
          });
        } else {
          onTransformFigure(figureId, { rotationY: target.rotation.y });
        }
      }}
    />
  );
}
