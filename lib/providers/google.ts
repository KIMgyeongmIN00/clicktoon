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
    const response = await withRetry("Google Nano Banana 2", () =>
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
