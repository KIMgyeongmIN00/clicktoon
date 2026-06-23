import { GoogleGenAI } from "@google/genai";
import { GenerateAdapter, GenerateInput, GenerateResult } from "./types";
import { buildPrompt } from "./prompt";
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
      input.characterName,
      input.characterMeta,
      input.pose,
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
            "You are a professional character illustrator. You receive a character reference image and a 3D mannequin pose reference, and you output a single illustration of that exact character in that exact pose. Always preserve the character's identity (face, hair, outfit, colors) from the reference. The mannequin is only a pose guide — never reproduce its gray material, dark background, grid floor, or 3D-render look.",
          imageConfig: { aspectRatio: input.size.aspect },
        },
      }),
    );

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
  },
};
