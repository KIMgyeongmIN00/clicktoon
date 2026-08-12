import { tasks } from "@trigger.dev/sdk";
import { nanoid } from "nanoid";
import { z } from "zod";
import {
  serverSupabase,
  REF_BUCKET,
  RESULT_BUCKET,
} from "@/lib/supabase/server";
import { signedUploadUrl, signedDownloadUrl } from "@/lib/storage/presign";
import { characterMetaSchema } from "@/types/character";
import { loadCharactersOrdered } from "@/lib/generation/characters";
import {
  characterIdsFromPose,
  buildPromptFigures,
} from "@/lib/generation/figures";
import { parsePoseState, figureLayoutSchema, CANVAS_SIZES } from "@/types/pose";
import { Provider } from "@/lib/providers/types";
import type { JobQueue, GenerationJob } from "./queue";
import type { generateImageTask } from "@/trigger/generate-image";

const RENDER_BUCKET = "renders";

// Trigger.dev로 작업을 보내는 JobQueue. 작업 입력을 row+storage에서 읽어 presigned
// 페이로드를 만들어 task를 트리거한다(task는 DB·키 없이 동작 — D2-B).
export function makeTriggerQueue(callbackOrigin: string): JobQueue {
  return {
    async enqueue(job: GenerationJob) {
      const sb = serverSupabase();
      const genRes = await sb
        .from("generations")
        .select("*")
        .eq("id", job.generationId)
        .single();
      if (genRes.error) throw genRes.error;
      const gen = genRes.data;

      const kind = (gen.kind ?? "pose") as "pose" | "concept";
      // concept: 포즈 렌더 없음 — 고정 3:4 컨셉아트. pose: 기존 흐름.
      // 구 스키마로 저장된 기존 행도 읽어야 한다(재시도·reaper 경로).
      const pose = kind === "pose" ? parsePoseState(gen.pose) : undefined;
      const aspect = pose?.aspect ?? "3:4";
      const dims = CANVAS_SIZES[aspect] ?? CANVAS_SIZES["3:4"];

      // 등장인물은 장면에서 뽑는다. character_id는 대표 1명일 뿐.
      // concept과 구 행(pose에 캐릭터 배정이 없음)은 대표 1명으로 떨어진다.
      const fromPose = pose ? characterIdsFromPose(pose) : [];
      const ids = fromPose.length ? fromPose : [gen.character_id as string];
      const characters = await loadCharactersOrdered(sb, ids);

      const charPayload = await Promise.all(
        characters.map(async (c) => ({
          name: c.name,
          meta: characterMetaSchema.parse(c.meta),
          refUrl: await signedDownloadUrl(REF_BUCKET, c.ref_path),
        })),
      );

      const layout = z.array(figureLayoutSchema).safeParse(gen.figure_layout);
      const figures = pose
        ? buildPromptFigures(pose, ids, layout.success ? layout.data : null)
        : undefined;

      const renderUrl =
        kind === "pose"
          ? await signedDownloadUrl(RENDER_BUCKET, gen.render_path)
          : undefined;
      const upload = await signedUploadUrl(
        RESULT_BUCKET,
        `${gen.character_id}/${nanoid(12)}.png`,
      );

      await tasks.trigger<typeof generateImageTask>(
        "generate-image",
        {
          generationId: job.generationId,
          kind,
          provider: gen.provider as Provider,
          characters: charPayload,
          figures,
          pose,
          extraPrompt: gen.extra_prompt ?? null,
          size: { w: dims.w, h: dims.h, aspect },
          renderUrl,
          resultUpload: {
            bucket: RESULT_BUCKET,
            path: upload.path,
            token: upload.token,
          },
          callbackUrl: `${callbackOrigin}/api/generations/${job.generationId}/callback`,
        },
        { idempotencyKey: gen.idempotency_key ?? job.generationId },
      );
    },
  };
}
