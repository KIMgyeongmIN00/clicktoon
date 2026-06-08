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

export function buildPrompt(
  characterName: string,
  meta: CharacterMeta,
  pose: PoseState,
  extra?: string,
): string {
  const sketch = pose.renderMode === "sketch";
  const parts: string[] = [];
  parts.push(
    `Render the SAME character ("${characterName}") from the reference image, with IDENTICAL identity (face, hair, outfit${sketch ? "" : ", color palette"}).`,
  );
  parts.push(
    sketch
      ? "Only the POSE must change to match the mannequin pose reference image."
      : "Only the POSE and LIGHTING must change to match the mannequin pose reference image.",
  );
  parts.push(`Main concept: ${meta.mainConcept}.`);
  if (meta.gender) parts.push(`Gender: ${meta.gender}.`);
  if (meta.proportions?.heads)
    parts.push(`Body proportions: ~${meta.proportions.heads}-head body.`);
  if (meta.proportions?.build)
    parts.push(`Build: ${meta.proportions.build}.`);
  if (meta.proportions?.buildNotes)
    parts.push(`Build notes: ${meta.proportions.buildNotes}`);
  if (meta.styleNotes) parts.push(`Style notes: ${meta.styleNotes}`);
  if (meta.tags?.length) parts.push(`Tags: ${meta.tags.join(", ")}.`);

  // Lighting only matters when we actually shade/color the output.
  if (!sketch) parts.push(describeLight(pose));

  parts.push(
    "Treat the second image as POSE REFERENCE ONLY — copy joint angles and overall stance but do NOT copy its visual style or the mannequin look.",
  );

  if (sketch) {
    parts.push(
      "Output: black-and-white LINE ART / sketch ONLY — clean inked contour lines describing the character in the new pose. Absolutely NO color fills, NO shading, NO gradients, NO lighting effects; pure linework on a plain white background. No mannequin, no skeleton overlay.",
    );
  } else {
    parts.push(
      "Output: clean, high-quality FULLY COLORED illustration with proper interior coloring, shading and light/shadow rendering, in the new pose. No mannequin, no skeleton overlay.",
    );
  }

  if (extra) parts.push(`Additional direction: ${extra}`);
  return parts.join(" ");
}
