import { CharacterMeta } from "@/types/character";
import { PoseState } from "@/types/pose";

export type PromptCharacter = { name: string; meta: CharacterMeta };

/** 마네킹 1체 = 캐릭터 1명 + 화면상의 위치 서술. */
export type PromptFigure = {
  /** characters 배열의 인덱스. 그대로 [IMAGE n]의 n-1이 된다. */
  characterIndex: number;
  /** describeFigurePlacement가 만든 위치 서술. 예: "on the LEFT" */
  descriptor: string;
};

function describeLight(pose: PoseState): string {
  const { x, y, intensity, color } = pose.light2d;
  const horiz = x < -0.33 ? "left" : x > 0.33 ? "right" : "center";
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

// 캐릭터 1명분 정체성 블록. 여러 명일 때는 어느 이미지의 누구인지 헷갈리지
// 않도록 지시문에 이름과 이미지 번호를 함께 박는다.
function characterBlock(
  c: PromptCharacter,
  index: number,
  sketch: boolean,
  multi: boolean,
): string[] {
  const no = index + 1;
  const meta = c.meta;
  const lines: string[] = [];

  lines.push(`[IMAGE ${no}] is the CHARACTER REFERENCE for "${c.name}".`);
  lines.push(
    multi
      ? `Preserve "${c.name}"'s identity EXACTLY as shown in [IMAGE ${no}] — same face and facial features, same hairstyle and hair color, same outfit and its design${sketch ? "" : ", same color palette"}. Do not redesign, restyle, age, or alter this character.`
      : `Preserve this character's identity EXACTLY — same face and facial features, same hairstyle and hair color, same outfit and its design${sketch ? "" : ", same color palette"}. Do not redesign, restyle, age, or alter the character.`,
  );

  const label = multi ? `"${c.name}" — ` : "";
  if (meta.mainConcept) lines.push(`${label}Character concept: ${meta.mainConcept}.`);
  if (meta.outfit) lines.push(`${label}Outfit: ${meta.outfit}.`);
  if (meta.gender) lines.push(`${label}Gender: ${meta.gender}.`);
  if (meta.proportions?.heads)
    lines.push(
      `${label}Proportions: roughly a ${meta.proportions.heads}-head figure.`,
    );
  if (meta.proportions?.build) lines.push(`${label}Build: ${meta.proportions.build}.`);
  if (meta.proportions?.buildNotes)
    lines.push(`${label}Build notes: ${meta.proportions.buildNotes}`);
  if (meta.styleNotes) lines.push(`${label}Art style: ${meta.styleNotes}`);
  if (meta.tags?.length) lines.push(`${label}Tags: ${meta.tags.join(", ")}.`);

  return lines;
}

// 이미지들을 명시적으로 라벨링([IMAGE 1..N]=캐릭터, [IMAGE N+1]=포즈 마네킹)하고,
// 정체성 보존을 강하게, 마네킹 아티팩트(회색/어두운 배경/그리드/3D 룩)를 구체적으로
// 억제하도록 구조화한다. (AI 퀄리티 개선 — 캐릭터 일치도·포즈 정확도·마네킹 누출 방지)
//
// 캐릭터가 2명 이상이면 합성 렌더 한 장에 마네킹이 여러 체 들어간다. 이미지
// API에는 "이미지의 이 부분이 저 캐릭터"라고 지정할 수단이 없으므로, 화면상의
// 위치 서술(figures[].descriptor)로 마네킹과 [IMAGE n]을 이어 준다.
export function buildPrompt(
  characters: PromptCharacter[],
  figures: PromptFigure[],
  pose: PoseState,
  extra?: string,
): string {
  const sketch = pose.renderMode === "sketch";
  const n = characters.length;
  const multi = n > 1;
  const poseNo = n + 1;
  const lines: string[] = [];

  // ── 캐릭터 정체성 ([IMAGE 1..N]) ──
  characters.forEach((c, i) => {
    lines.push(...characterBlock(c, i, sketch, multi));
  });

  // ── 포즈 ([IMAGE N+1]) + 마네킹↔캐릭터 매핑 + 마네킹 억제 ──
  if (multi) {
    lines.push(
      `[IMAGE ${poseNo}] is a POSE REFERENCE — plain gray 3D mannequins showing ${n} figures posed together in one scene. Copy ONLY the body poses and the spatial arrangement from it: joint angles, limb directions, torso orientation, head tilt, weight distribution, and where each figure stands relative to the others.`,
    );
    lines.push(`Figure-to-character mapping in [IMAGE ${poseNo}]:`);
    for (const f of figures) {
      const c = characters[f.characterIndex];
      if (!c) continue;
      lines.push(
        `- the mannequin ${f.descriptor} is "${c.name}" — draw it as [IMAGE ${f.characterIndex + 1}].`,
      );
    }
    lines.push(
      `Each figure must keep its OWN character's identity from its own reference image. Do not blend, swap, or merge the characters, and do not add any character that is not in the mapping above.`,
    );
    lines.push(
      `Do NOT reproduce anything about the mannequins' appearance: not their gray/matte material, not the dark background, not the grid floor, not the 3D-render/CGI look, not their shadows. They are pose guides only.`,
    );
  } else {
    lines.push(
      `[IMAGE ${poseNo}] is a POSE REFERENCE — a plain gray 3D mannequin. Copy ONLY the body pose from it: joint angles, limb directions, torso orientation, head tilt, and weight distribution.`,
    );
    lines.push(
      `Do NOT reproduce anything about the mannequin's appearance: not its gray/matte material, not the dark background, not the grid floor, not the 3D-render/CGI look, not its shadows. It is a pose guide only.`,
    );
  }

  // 채색 모드일 때만 광원 지시.
  if (!sketch) lines.push(describeLight(pose));

  // ── 출력 ──
  if (sketch) {
    lines.push(
      multi
        ? `OUTPUT: black-and-white LINE ART only — clean inked contour lines of all ${n} characters together in one scene, each in its mapped pose, on a plain white background. No color fills, no shading, no gradients, no lighting, no background scene, no mannequin or skeleton overlay.`
        : `OUTPUT: black-and-white LINE ART only — clean inked contour lines of the character in the new pose on a plain white background. No color fills, no shading, no gradients, no lighting, no background scene, no mannequin or skeleton overlay.`,
    );
  } else {
    lines.push(
      multi
        ? `OUTPUT: a single high-quality, fully colored illustration showing all ${n} characters together in one scene, each in its mapped pose, with proper interior coloring and light/shadow shading. No mannequins, no skeletons, no grid, no 3D-render artifacts.`
        : `OUTPUT: a single high-quality, fully colored illustration of the character in the new pose, with proper interior coloring and light/shadow shading. No mannequin, no skeleton, no grid, no 3D-render artifacts.`,
    );
  }
  lines.push(`Compose for a ${pose.aspect} frame.`);

  if (extra) lines.push(`Additional direction: ${extra}`);
  return lines.join("\n");
}

// 경로 B — 단일 러프 이미지를 정제된 캐릭터 컨셉아트로. (kind='concept')
// 입력 이미지 1장 + 캐릭터 메타로, 정면 전신 컨셉 일러스트를 생성한다.
export function buildConceptPrompt(
  characterName: string,
  meta: CharacterMeta,
  extra?: string,
): string {
  const lines: string[] = [];
  lines.push(
    `[IMAGE 1] is a rough/single reference of a character${characterName ? ` named "${characterName}"` : ""}.`,
  );
  lines.push(
    `Produce a polished, front-facing full-body CHARACTER CONCEPT ART based on it: refine the rough reference into a clean, coherent, professional character design illustration.`,
  );
  lines.push(
    `Preserve the character's core identity from the reference — silhouette, key features, hairstyle, outfit, and color palette — but elevate the rendering quality and consistency.`,
  );
  if (meta.mainConcept) lines.push(`Concept: ${meta.mainConcept}.`);
  if (meta.outfit) lines.push(`Outfit: ${meta.outfit}.`);
  if (meta.gender) lines.push(`Gender: ${meta.gender}.`);
  if (meta.proportions?.heads)
    lines.push(`Proportions: roughly a ${meta.proportions.heads}-head figure.`);
  if (meta.styleNotes) lines.push(`Art style: ${meta.styleNotes}.`);
  lines.push(
    `OUTPUT: a single clean full-body character concept illustration on a plain neutral background. No text, no watermark, no multiple panels.`,
  );
  if (extra) lines.push(`Additional direction: ${extra}`);
  return lines.join("\n");
}
