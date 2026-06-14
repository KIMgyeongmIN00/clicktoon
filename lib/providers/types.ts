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

/** User-facing display names for each provider (used in UI labels/tags). */
export const PROVIDER_LABELS: Record<Provider, string> = {
  google: "Google Gemini",
  openai: "OpenAI",
};

export interface GenerateAdapter {
  readonly id: Provider;
  generate(input: GenerateInput): Promise<GenerateResult>;
}
