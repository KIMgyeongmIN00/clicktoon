import { GoogleGenAI } from "@google/genai";
import {
  GenerateAdapter,
  GenerateInput,
  GenerateResult,
  ConceptInput,
} from "./types";
import { buildPrompt, buildConceptPrompt } from "./prompt";
import { withRetry } from "./retry";

const MODEL =
  process.env.GOOGLE_IMAGE_MODEL ?? "gemini-3.1-flash-image-preview";

function getClient(apiKeyOverride?: string): GoogleGenAI {
  const apiKey = apiKeyOverride?.trim() || process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey)
    throw new Error(
      "Google Gemini API 키가 없습니다. 진입 화면에서 키를 다시 입력해주세요.",
    );
  return new GoogleGenAI({ apiKey });
}

export const googleAdapter: GenerateAdapter = {
  id: "google",
  async generate(input: GenerateInput): Promise<GenerateResult> {
    const prompt = buildPrompt(
      input.characters.map((c) => ({ name: c.name, meta: c.meta })),
      input.figures,
      input.pose,
      input.extraPrompt,
    );
    const ai = getClient(input.apiKey);
    const response = await withRetry("Google Gemini", () =>
      ai.models.generateContent({
        model: MODEL,
        // contents의 이미지 순서가 프롬프트의 [IMAGE n] 번호다. 캐릭터들이
        // 먼저(1..N), 합성 포즈 렌더가 마지막(N+1).
        contents: [
          { text: prompt },
          ...input.characters.map((c) => ({
            inlineData: {
              data: c.image.buffer.toString("base64"),
              mimeType: c.image.mime,
            },
          })),
          {
            inlineData: {
              data: input.poseRenderImage.buffer.toString("base64"),
              mimeType: input.poseRenderImage.mime,
            },
          },
        ],
        config: {
          // 시스템 차원에서 작업을 프레이밍 — 정체성 보존 + 마네킹 룩 억제.
          systemInstruction:
            "You are a professional character illustrator. You receive one or more character reference images followed by a 3D mannequin pose reference, and you output a single illustration of those exact characters in those exact poses. Always preserve each character's identity (face, hair, outfit, colors) from its own reference image, and never blend or swap two characters. The mannequins are only pose guides — never reproduce their gray material, dark background, grid floor, or 3D-render look.",
          imageConfig: { aspectRatio: input.size.aspect },
        },
      }),
    );

    return extractImage(response, prompt);
  },

  // 경로 B — 단일 이미지 → 정제된 캐릭터 컨셉아트.
  async generateConcept(input: ConceptInput): Promise<GenerateResult> {
    const prompt = buildConceptPrompt(
      input.characterName,
      input.characterMeta,
      input.extraPrompt,
    );
    const ai = getClient(input.apiKey);
    const response = await withRetry("Google Gemini", () =>
      ai.models.generateContent({
        model: MODEL,
        contents: [
          { text: prompt },
          {
            inlineData: {
              data: input.referenceImage.buffer.toString("base64"),
              mimeType: input.referenceImage.mime,
            },
          },
        ],
        config: {
          systemInstruction:
            "You are a professional character concept artist. Given a rough or single reference image of a character, produce one polished, front-facing full-body character concept illustration that preserves the character's core identity (silhouette, features, hairstyle, outfit, colors) while elevating rendering quality and consistency.",
          imageConfig: { aspectRatio: input.size.aspect },
        },
      }),
    );
    return extractImage(response, prompt);
  },
};

function extractImage(
  response: { candidates?: { content?: { parts?: unknown[] } }[] },
  prompt: string,
): GenerateResult {
  const parts = response.candidates?.[0]?.content?.parts ?? [];
  for (const part of parts) {
    const inline = (part as { inlineData?: { data?: string; mimeType?: string } })
      .inlineData;
    if (inline?.data) {
      return {
        buffer: Buffer.from(inline.data, "base64"),
        mime: inline.mimeType ?? "image/png",
        prompt,
        model: MODEL,
      };
    }
  }
  throw new Error("Google: no image returned in response");
}
