import { PoseState } from "@/types/pose";
import { CharacterMeta } from "@/types/character";

export type GenerateInput = {
  characterMeta: CharacterMeta;
  characterName: string;
  referenceImage: { buffer: Buffer; mime: string };
  poseRenderImage: { buffer: Buffer; mime: string };
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

export interface GenerateAdapter {
  readonly id: Provider;
  generate(input: GenerateInput): Promise<GenerateResult>;
}
