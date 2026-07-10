import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { serverSupabase } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/supabase/session";
import { adapters } from "@/lib/providers";
import { hasQuota, isUnlimitedEmail } from "@/lib/quota";
import { poseStateSchema } from "@/types/pose";
import { dataUrlToBuffer } from "@/lib/utils";
import { stubQueue } from "@/lib/jobs/stub";
import { makeTriggerQueue } from "@/lib/jobs/trigger";
import { makeDemoQueue } from "@/lib/jobs/demo";
import { isDemoMode } from "@/lib/demo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30; // 시연 모드 after() 백그라운드 작업(지연+업로드) 여유

const RENDER_BUCKET = "renders";

// 비동기 enqueue + 크레딧 예약 차감. 로그인 필수, 본인 캐릭터로만, 잔액 부족 시 402.
export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user)
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

    const body = await req.json();
    const characterId = String(body.characterId ?? "");
    const provider = String(body.provider ?? "") as "google" | "openai";
    const poseRenderDataUrl = String(body.poseRenderDataUrl ?? "");
    const extraPrompt =
      typeof body.extraPrompt === "string" && body.extraPrompt.trim()
        ? body.extraPrompt
        : null;
    const pose = poseStateSchema.parse(body.pose);
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
    const demo = await isDemoMode();

    // 본인 캐릭터인지 확인
    const charRes = await sb
      .from("characters")
      .select("id,owner")
      .eq("id", characterId)
      .maybeSingle();
    if (charRes.error) throw charRes.error;
    if (!charRes.data || charRes.data.owner !== user.id)
      return NextResponse.json(
        { error: "캐릭터를 찾을 수 없습니다." },
        { status: 404 },
      );

    // 무료 쿼터 확인 (결제 OFF 기간 — 포즈 생성 계정당 2회).
    // 시연 모드·면제 계정(UNLIMITED_EMAILS)은 무제한.
    if (!demo && !isUnlimitedEmail(user.email) && !(await hasQuota(user.id, "pose")))
      return NextResponse.json(
        { error: "무료 생성 횟수를 모두 사용했어요.", code: "QUOTA_EXCEEDED" },
        { status: 402 },
      );

    // 렌더 업로드
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

    // 원자적 enqueue + 예약 차감 (잔액 부족 시 예외)
    const enq = await sb.rpc("enqueue_generation", {
      p_character_id: characterId,
      p_provider: provider,
      p_pose: pose,
      p_render_path: renderPath,
      p_extra_prompt: extraPrompt,
      p_idempotency_key: idempotencyKey,
      p_owner: user.id,
      p_cost: 0, // 결제 OFF — 쿼터로 제한 (크레딧 인프라는 휴면)
      p_kind: "pose",
    });
    if (enq.error) throw enq.error;
    const generationId = enq.data as string;

    // 비동기 처리 트리거: 시연 모드 → 데모 큐(지정 이미지), 아니면 Trigger.dev / 스텁
    const origin = process.env.APP_URL ?? req.nextUrl.origin;
    const queue = demo
      ? makeDemoQueue(origin)
      : process.env.TRIGGER_SECRET_KEY
        ? makeTriggerQueue(origin)
        : stubQueue;
    await queue.enqueue({ generationId });

    return NextResponse.json(
      { generationId, status: "queued" },
      { status: 202 },
    );
  } catch (e) {
    console.error("[generate enqueue]", e);
    return NextResponse.json(
      { error: "내부 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
