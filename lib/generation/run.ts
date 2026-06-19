import { nanoid } from "nanoid";
import { REF_BUCKET, RESULT_BUCKET, serverSupabase } from "@/lib/supabase/server";
import { adapters } from "@/lib/providers";
import { Provider } from "@/lib/providers/types";
import { CANVAS_SIZES, poseStateSchema } from "@/types/pose";
import { characterMetaSchema, Character } from "@/types/character";

const RENDER_BUCKET = "renders";

// queued/processing generation row 하나를 실제로 생성 실행한다. 입력(캐릭터·레퍼런스·
// 포즈 렌더·포즈·추가지시)을 row + storage에서 읽어 프로바이더 어댑터를 호출하고
// 결과를 업로드한 뒤 출력 필드를 반환한다. 실패 시 throw(호출자가 failed 처리).
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
  if (!gen.render_path) throw new Error("render_path missing");
  const pose = poseStateSchema.parse(gen.pose);

  // 캐릭터 + 레퍼런스 이미지
  const charRes = await sb
    .from("characters")
    .select("*")
    .eq("id", gen.character_id)
    .single();
  if (charRes.error) throw charRes.error;
  const character = charRes.data as Character;
  const meta = characterMetaSchema.parse(character.meta);

  const refDl = await sb.storage.from(REF_BUCKET).download(character.ref_path);
  if (refDl.error || !refDl.data)
    throw refDl.error ?? new Error("ref download failed");
  const refBuffer = Buffer.from(await refDl.data.arrayBuffer());
  const refMime = refDl.data.type || "image/png";

  // 입력 포즈 렌더
  const rDl = await sb.storage.from(RENDER_BUCKET).download(gen.render_path);
  if (rDl.error || !rDl.data)
    throw rDl.error ?? new Error("render download failed");
  const renderBuffer = Buffer.from(await rDl.data.arrayBuffer());
  const renderMime = rDl.data.type || "image/png";

  const aspect = pose.aspect ?? "3:4";
  const dims = CANVAS_SIZES[aspect] ?? CANVAS_SIZES["3:4"];

  const result = await adapters[provider].generate({
    characterName: character.name,
    characterMeta: meta,
    referenceImage: { buffer: refBuffer, mime: refMime },
    poseRenderImage: { buffer: renderBuffer, mime: renderMime },
    pose,
    extraPrompt: gen.extra_prompt ?? undefined,
    apiKey: undefined, // 서버 키(env)
    size: { w: dims.w, h: dims.h, aspect },
  });

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
