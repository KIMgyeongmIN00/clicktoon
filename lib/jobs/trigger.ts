import { tasks } from "@trigger.dev/sdk";
import { nanoid } from "nanoid";
import {
  serverSupabase,
  REF_BUCKET,
  RESULT_BUCKET,
} from "@/lib/supabase/server";
import { signedUploadUrl, signedDownloadUrl } from "@/lib/storage/presign";
import { characterMetaSchema, Character } from "@/types/character";
import { poseStateSchema, CANVAS_SIZES } from "@/types/pose";
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

      const charRes = await sb
        .from("characters")
        .select("*")
        .eq("id", gen.character_id)
        .single();
      if (charRes.error) throw charRes.error;
      const character = charRes.data as Character;
      const meta = characterMetaSchema.parse(character.meta);
      const pose = poseStateSchema.parse(gen.pose);
      const aspect = pose.aspect ?? "3:4";
      const dims = CANVAS_SIZES[aspect] ?? CANVAS_SIZES["3:4"];

      const refUrl = await signedDownloadUrl(REF_BUCKET, character.ref_path);
      const renderUrl = await signedDownloadUrl(RENDER_BUCKET, gen.render_path);
      const upload = await signedUploadUrl(
        RESULT_BUCKET,
        `${gen.character_id}/${nanoid(12)}.png`,
      );

      await tasks.trigger<typeof generateImageTask>(
        "generate-image",
        {
          generationId: job.generationId,
          provider: gen.provider as Provider,
          characterName: character.name,
          characterMeta: meta,
          pose,
          extraPrompt: gen.extra_prompt ?? null,
          size: { w: dims.w, h: dims.h, aspect },
          refUrl,
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
