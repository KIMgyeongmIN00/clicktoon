import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { serverSupabase } from "@/lib/supabase/server";
import { adapters } from "@/lib/providers";
import { generationCost } from "@/lib/credits/cost";
import { poseStateSchema } from "@/types/pose";
import { dataUrlToBuffer } from "@/lib/utils";
import { stubQueue } from "@/lib/jobs/stub";
import { makeTriggerQueue } from "@/lib/jobs/trigger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RENDER_BUCKET = "renders";

// 비동기 enqueue: 입력 렌더를 storage에 올리고, generations(queued) + job_outbox를
// 원자적으로 생성한 뒤 즉시 202 { generationId } 반환. 실제 AI 생성은 워커가 수행한다.
// Phase A: 인프로세스 스텁. Phase B: Trigger.dev task. (SDD §3, §4-D4)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const characterId = String(body.characterId ?? "");
    const provider = String(body.provider ?? "") as "google" | "openai";
    const poseRenderDataUrl = String(body.poseRenderDataUrl ?? "");
    const extraPrompt =
      typeof body.extraPrompt === "string" && body.extraPrompt.trim()
        ? body.extraPrompt
        : null;
    const pose = poseStateSchema.parse(body.pose);
    // 클라가 안정 키를 주면 중복 제출 dedup; 없으면 요청별 생성.
    const idempotencyKey =
      typeof body.idempotencyKey === "string" && body.idempotencyKey
        ? body.idempotencyKey
        : nanoid(16);

    if (!characterId)
      return NextResponse.json({ error: "characterId required" }, { status: 400 });
    if (!adapters[provider])
      return NextResponse.json(
        { error: `unknown provider: ${provider}` },
        { status: 400 },
      );
    if (!poseRenderDataUrl.startsWith("data:"))
      return NextResponse.json(
        { error: "poseRenderDataUrl must be a data URL" },
        { status: 400 },
      );

    const sb = serverSupabase();

    // 입력 포즈 렌더를 renders 버킷에 업로드 (DB outbox에 base64를 싣지 않도록).
    const render = dataUrlToBuffer(poseRenderDataUrl);
    const renderExt =
      render.mime === "image/jpeg"
        ? "jpg"
        : render.mime === "image/webp"
          ? "webp"
          : "png";
    const renderPath = `${characterId}/${nanoid(12)}.${renderExt}`;
    const rup = await sb.storage
      .from(RENDER_BUCKET)
      .upload(renderPath, render.buffer, {
        contentType: render.mime,
        upsert: false,
      });
    if (rup.error) throw rup.error;

    // 원자적 enqueue (generations queued + job_outbox pending) — 트랜잭션 outbox.
    const enq = await sb.rpc("enqueue_generation", {
      p_character_id: characterId,
      p_provider: provider,
      p_pose: pose,
      p_render_path: renderPath,
      p_extra_prompt: extraPrompt,
      p_idempotency_key: idempotencyKey,
      p_owner: null, // Phase C: auth.uid()
    });
    if (enq.error) throw enq.error;
    const generationId = enq.data as string;

    // 비동기 처리 트리거: TRIGGER_SECRET_KEY 있으면 Trigger.dev, 없으면 인프로세스 스텁.
    const origin = process.env.APP_URL ?? req.nextUrl.origin;
    const queue = process.env.TRIGGER_SECRET_KEY
      ? makeTriggerQueue(origin)
      : stubQueue;
    await queue.enqueue({ generationId });

    return NextResponse.json(
      { generationId, status: "queued", cost: generationCost(provider) },
      { status: 202 },
    );
  } catch (e) {
    console.error("[generate enqueue]", e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
