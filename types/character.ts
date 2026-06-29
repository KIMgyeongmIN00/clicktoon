import { z } from "zod";

export const characterMetaSchema = z.object({
  gender: z.enum(["male", "female", "nonbinary", "other"]).optional(),
  proportions: z
    .object({
      heads: z.number().min(2).max(12).optional(),
      build: z
        .enum(["slim", "athletic", "muscular", "plump", "custom"])
        .optional(),
      buildNotes: z.string().max(500).optional(),
    })
    .default({}),
  mainConcept: z.string().min(1).max(300),
  outfit: z.string().max(500).optional(),
  styleNotes: z.string().max(1000).optional(),
  tags: z.array(z.string().min(1).max(40)).max(20).default([]),
});

export type CharacterMeta = z.infer<typeof characterMetaSchema>;

export type Character = {
  id: string;
  owner: string | null;
  name: string;
  ref_path: string;
  thumb_path: string | null;
  meta: CharacterMeta;
  created_at: string;
  updated_at: string;
};

export type CharacterWithUrls = Character & {
  ref_url: string;
  thumb_url: string | null;
};

export type Generation = {
  id: string;
  character_id: string;
  provider: "google" | "openai";
  model: string;
  prompt: string;
  pose: unknown;
  result_path: string;
  created_at: string;
};

export type GenerationWithUrl = Generation & {
  result_url: string;
};
