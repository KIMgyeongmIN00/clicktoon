import OpenAI, { toFile } from "openai";
import {
  GenerateAdapter,
  GenerateInput,
  GenerateResult,
  ConceptInput,
} from "./types";
import { buildPrompt, buildConceptPrompt } from "./prompt";
import { withRetry } from "./retry";

const MODEL = process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-2";

function getClient(apiKeyOverride?: string): OpenAI {
  const apiKey = apiKeyOverride?.trim() || process.env.OPENAI_API_KEY;
  if (!apiKey)
    throw new Error(
      "OpenAI API 키가 없습니다. 진입 화면에서 키를 다시 입력해주세요.",
    );
  return new OpenAI({ apiKey });
}

export const openaiAdapter: GenerateAdapter = {
  id: "openai",
  async generate(input: GenerateInput): Promise<GenerateResult> {
    const prompt = buildPrompt(
      input.characters.map((c) => ({ name: c.name, meta: c.meta })),
      input.figures,
      input.pose,
      input.extraPrompt,
    );
    const openai = getClient(input.apiKey);

    const refFiles = await Promise.all(
      input.characters.map((c, i) =>
        toFile(c.image.buffer, `ref${i + 1}.${guessExt(c.image.mime)}`, {
          type: c.image.mime,
        }),
      ),
    );
    const poseFile = await toFile(
      input.poseRenderImage.buffer,
      `pose.${guessExt(input.poseRenderImage.mime)}`,
      { type: input.poseRenderImage.mime },
    );

    const result = await withRetry("OpenAI gpt-image-2", () =>
      openai.images.edit({
        model: MODEL,
        // 배열 순서가 프롬프트의 [IMAGE n] 번호다. 캐릭터들이 먼저(1..N),
        // 합성 포즈 렌더가 마지막(N+1).
        image: [...refFiles, poseFile],
        prompt,
        size: pickOpenAISize(input.size),
        quality: "high",
      }),
    );

    const b64 = result.data?.[0]?.b64_json;
    if (!b64) throw new Error("OpenAI: no image returned");
    return {
      buffer: Buffer.from(b64, "base64"),
      mime: "image/png",
      prompt,
      model: MODEL,
    };
  },

  // 경로 B — 단일 이미지 → 정제된 캐릭터 컨셉아트.
  async generateConcept(input: ConceptInput): Promise<GenerateResult> {
    const prompt = buildConceptPrompt(
      input.characterName,
      input.characterMeta,
      input.extraPrompt,
    );
    const openai = getClient(input.apiKey);
    const refFile = await toFile(
      input.referenceImage.buffer,
      `ref.${guessExt(input.referenceImage.mime)}`,
      { type: input.referenceImage.mime },
    );
    const result = await withRetry("OpenAI gpt-image-2", () =>
      openai.images.edit({
        model: MODEL,
        image: [refFile],
        prompt,
        size: pickOpenAISize(input.size),
        quality: "high",
      }),
    );
    const b64 = result.data?.[0]?.b64_json;
    if (!b64) throw new Error("OpenAI: no image returned");
    return {
      buffer: Buffer.from(b64, "base64"),
      mime: "image/png",
      prompt,
      model: MODEL,
    };
  },
};

// gpt-image-2 supports 1024x1024, 1024x1536 (portrait), 1536x1024 (landscape).
function pickOpenAISize(size: {
  w: number;
  h: number;
}): "1024x1024" | "1024x1536" | "1536x1024" {
  const ratio = size.w / size.h;
  if (ratio > 1.15) return "1536x1024";
  if (ratio < 0.87) return "1024x1536";
  return "1024x1024";
}

function guessExt(mime: string): string {
  if (mime.includes("png")) return "png";
  if (mime.includes("jpeg") || mime.includes("jpg")) return "jpg";
  if (mime.includes("webp")) return "webp";
  return "png";
}
