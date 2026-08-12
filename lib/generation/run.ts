import { nanoid } from "nanoid";
import type { SupabaseClient } from "@supabase/supabase-js";
import { REF_BUCKET, RESULT_BUCKET, serverSupabase } from "@/lib/supabase/server";
import { adapters } from "@/lib/providers";
import { Provider, ReferenceImage } from "@/lib/providers/types";
import { CANVAS_SIZES, figureLayoutSchema, parsePoseState } from "@/types/pose";
import { characterIdsFromPose, buildPromptFigures } from "@/lib/generation/figures";
import { characterMetaSchema } from "@/types/character";
import { loadCharactersOrdered } from "@/lib/generation/characters";
import { z } from "zod";

const RENDER_BUCKET = "renders";

async function downloadRef(
  sb: SupabaseClient,
  path: string,
): Promise<ReferenceImage> {
  const dl = await sb.storage.from(REF_BUCKET).download(path);
  if (dl.error || !dl.data) throw dl.error ?? new Error("ref download failed");
  return {
    buffer: Buffer.from(await dl.data.arrayBuffer()),
    mime: dl.data.type || "image/png",
  };
}

// queued/processing generation row 하나를 실제로 생성 실행한다. 입력(등장인물·
// 레퍼런스·포즈 렌더·포즈·추가지시)을 row + storage에서 읽어 프로바이더 어댑터를
// 호출하고 결과를 업로드한 뒤 출력 필드를 반환한다. 실패 시 throw(호출자가 failed 처리).
//
// AI 키는 서버 env 폴백(`lib/providers/*`)을 사용한다.
export async function runGeneration(
  generationId: string,
): Promise<{ resultPath: string; model: string; prompt: string }> {
  const sb = serverSupabase();

  const genRes = await sb
    .from("generations")
    .select("*")
    .eq("id", generationId)
    .single();
  if (genRes.error) throw genRes.error;
  const gen = genRes.data;

  const provider = gen.provider as Provider;
  if (!adapters[provider]) throw new Error(`unknown provider: ${provider}`);

  let result;
  if (gen.kind === "concept") {
    // 경로 B — 대표 캐릭터 1명의 레퍼런스 → 컨셉아트 (포즈 렌더 불필요)
    const [character] = await loadCharactersOrdered(sb, [gen.character_id]);
    const meta = characterMetaSchema.parse(character.meta);
    const dims = CANVAS_SIZES["3:4"];
    result = await adapters[provider].generateConcept({
      characterName: character.name,
      characterMeta: meta,
      referenceImage: await downloadRef(sb, character.ref_path),
      extraPrompt: gen.extra_prompt ?? undefined,
      apiKey: undefined, // 서버 키(env)
      size: { w: dims.w, h: dims.h, aspect: "3:4" },
    });
  } else {
    if (!gen.render_path) throw new Error("render_path missing");
    const pose = parsePoseState(gen.pose);

    // 등장인물은 장면에서 뽑는다. character_id는 대표 1명일 뿐.
    // 구 행(캐릭터 배정 정보가 pose에 없음)은 대표 캐릭터 1명으로 떨어진다.
    const fromPose = characterIdsFromPose(pose);
    const ids = fromPose.length ? fromPose : [gen.character_id as string];
    const characters = await loadCharactersOrdered(sb, ids);
    const layout = z
      .array(figureLayoutSchema)
      .safeParse(gen.figure_layout);

    const refs = await Promise.all(
      characters.map((c) => downloadRef(sb, c.ref_path)),
    );

    // 입력 포즈 렌더
    const rDl = await sb.storage.from(RENDER_BUCKET).download(gen.render_path);
    if (rDl.error || !rDl.data)
      throw rDl.error ?? new Error("render download failed");

    const aspect = pose.aspect ?? "3:4";
    const dims = CANVAS_SIZES[aspect] ?? CANVAS_SIZES["3:4"];

    result = await adapters[provider].generate({
      characters: characters.map((c, i) => ({
        name: c.name,
        meta: characterMetaSchema.parse(c.meta),
        image: refs[i],
      })),
      figures: buildPromptFigures(
        pose,
        ids,
        layout.success ? layout.data : null,
      ),
      poseRenderImage: {
        buffer: Buffer.from(await rDl.data.arrayBuffer()),
        mime: rDl.data.type || "image/png",
      },
      pose,
      extraPrompt: gen.extra_prompt ?? undefined,
      apiKey: undefined, // 서버 키(env)
      size: { w: dims.w, h: dims.h, aspect },
    });
  }

  const ext =
    result.mime === "image/jpeg" || result.mime === "image/jpg"
      ? "jpg"
      : result.mime === "image/webp"
        ? "webp"
        : "png";
  const resultPath = `${gen.character_id}/${nanoid(12)}.${ext}`;
  const up = await sb.storage
    .from(RESULT_BUCKET)
    .upload(resultPath, result.buffer, {
      contentType: result.mime,
      upsert: false,
    });
  if (up.error) throw up.error;

  return { resultPath, model: result.model, prompt: result.prompt };
}
