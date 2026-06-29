import { CharacterMeta } from "@/types/character";
import { PoseState } from "@/types/pose";

function describeLight(pose: PoseState): string {
  const { x, y, intensity, color } = pose.light2d;
  const horiz =
    x < -0.33 ? "left" : x > 0.33 ? "right" : "center";
  const vert = y > 0.33 ? "top" : y < -0.33 ? "bottom" : "middle";
  let dir: string;
  if (horiz === "center" && vert === "middle") dir = "soft frontal";
  else if (horiz === "center") dir = `${vert}`;
  else if (vert === "middle") dir = `${horiz} side`;
  else dir = `${vert}-${horiz}`;
  const strength =
    intensity < 0.8 ? "dim" : intensity > 2.6 ? "strong" : "moderate";
  return `Lighting: ${strength} key light coming from the ${dir} of the frame, light color ${color}. Cast shadows accordingly.`;
}

// 두 이미지를 명시적으로 라벨링([IMAGE 1]=캐릭터, [IMAGE 2]=포즈 마네킹)하고,
// 정체성 보존을 강하게, 마네킹 아티팩트(회색/어두운 배경/그리드/3D 룩)를 구체적으로
// 억제하도록 구조화한다. (AI 퀄리티 개선 — 캐릭터 일치도·포즈 정확도·마네킹 누출 방지)
export function buildPrompt(
  characterName: string,
  meta: CharacterMeta,
  pose: PoseState,
  extra?: string,
): string {
  const sketch = pose.renderMode === "sketch";
  const lines: string[] = [];

  // ── 캐릭터 정체성 ([IMAGE 1]) ──
  lines.push(`[IMAGE 1] is the CHARACTER REFERENCE for "${characterName}".`);
  lines.push(
    `Preserve this character's identity EXACTLY — same face and facial features, same hairstyle and hair color, same outfit and its design${sketch ? "" : ", same color palette"}. Do not redesign, restyle, age, or alter the character.`,
  );
  if (meta.mainConcept) lines.push(`Character concept: ${meta.mainConcept}.`);
  if (meta.outfit) lines.push(`Outfit: ${meta.outfit}.`);
  if (meta.gender) lines.push(`Gender: ${meta.gender}.`);
  if (meta.proportions?.heads)
    lines.push(`Proportions: roughly a ${meta.proportions.heads}-head figure.`);
  if (meta.proportions?.build) lines.push(`Build: ${meta.proportions.build}.`);
  if (meta.proportions?.buildNotes)
    lines.push(`Build notes: ${meta.proportions.buildNotes}`);
  if (meta.styleNotes) lines.push(`Art style: ${meta.styleNotes}`);
  if (meta.tags?.length) lines.push(`Tags: ${meta.tags.join(", ")}.`);

  // ── 포즈 ([IMAGE 2]) + 마네킹 억제 ──
  lines.push(
    `[IMAGE 2] is a POSE REFERENCE — a plain gray 3D mannequin. Copy ONLY the body pose from it: joint angles, limb directions, torso orientation, head tilt, and weight distribution.`,
  );
  lines.push(
    `Do NOT reproduce anything about the mannequin's appearance: not its gray/matte material, not the dark background, not the grid floor, not the 3D-render/CGI look, not its shadows. It is a pose guide only.`,
  );

  // 채색 모드일 때만 광원 지시.
  if (!sketch) lines.push(describeLight(pose));

  // ── 출력 ──
  if (sketch) {
    lines.push(
      `OUTPUT: black-and-white LINE ART only — clean inked contour lines of the character in the new pose on a plain white background. No color fills, no shading, no gradients, no lighting, no background scene, no mannequin or skeleton overlay.`,
    );
  } else {
    lines.push(
      `OUTPUT: a single high-quality, fully colored illustration of the character in the new pose, with proper interior coloring and light/shadow shading. No mannequin, no skeleton, no grid, no 3D-render artifacts.`,
    );
  }
  lines.push(`Compose for a ${pose.aspect} frame.`);

  if (extra) lines.push(`Additional direction: ${extra}`);
  return lines.join("\n");
}
