import { PoseState } from "@/types/pose";
import { CharacterMeta } from "@/types/character";
import type { PromptFigure } from "./prompt";

export type ReferenceImage = { buffer: Buffer; mime: string };

export type GenerateCharacter = {
  name: string;
  meta: CharacterMeta;
  image: ReferenceImage;
};

export type GenerateInput = {
  /**
   * 장면에 등장하는 캐릭터들. **배열 순서가 곧 프롬프트의 [IMAGE 1..N]**이며,
   * 어댑터가 이미지를 실어 보내는 순서와 반드시 일치해야 한다 — 두 이미지 API
   * 모두 이미지에 역할/가중치를 붙일 수단이 없어 순서와 텍스트 라벨이 유일한
   * 구분자다.
   */
  characters: GenerateCharacter[];
  /** 합성 렌더의 각 마네킹이 어느 캐릭터이고 화면 어디에 있는지. */
  figures: PromptFigure[];
  poseRenderImage: ReferenceImage;
  pose: PoseState;
  extraPrompt?: string;
  /** Per-request API key supplied by the user (My Page). Falls back to env. */
  apiKey?: string;
  /** Output size in pixels + aspect label. */
  size: { w: number; h: number; aspect: string };
};

export type GenerateResult = {
  buffer: Buffer;
  mime: string;
  prompt: string;
  model: string;
};

export type Provider = "google" | "openai";

/** User-facing display names for each provider (used in UI labels/tags). */
export const PROVIDER_LABELS: Record<Provider, string> = {
  google: "Google Gemini",
  openai: "OpenAI",
};

/** 경로 B — 단일 이미지 → 컨셉아트 생성 입력. (등장인물 1명 고정) */
export type ConceptInput = {
  characterMeta: CharacterMeta;
  characterName: string;
  referenceImage: ReferenceImage;
  extraPrompt?: string;
  apiKey?: string;
  size: { w: number; h: number; aspect: string };
};

export interface GenerateAdapter {
  readonly id: Provider;
  generate(input: GenerateInput): Promise<GenerateResult>;
  generateConcept(input: ConceptInput): Promise<GenerateResult>;
}
