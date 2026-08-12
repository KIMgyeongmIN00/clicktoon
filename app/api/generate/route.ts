import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { z } from "zod";
import { serverSupabase } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/supabase/session";
import { adapters } from "@/lib/providers";
import { hasQuota, isUnlimitedEmail } from "@/lib/quota";
import { figureLayoutSchema, parsePoseState } from "@/types/pose";
import {
  characterIdsFromPose,
  unassignedFigureIds,
} from "@/lib/generation/figures";
import { dataUrlToBuffer } from "@/lib/utils";
import { stubQueue } from "@/lib/jobs/stub";
import { makeTriggerQueue } from "@/lib/jobs/trigger";
import { demoQueue } from "@/lib/jobs/demo";
import { isDemoMode } from "@/lib/demo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30; // 시연 모드 after() 백그라운드 작업(지연+업로드) 여유

const RENDER_BUCKET = "renders";

const layoutSchema = z.array(figureLayoutSchema).optional();

// 비동기 enqueue + 크레딧 예약 차감. 로그인 필수, 본인 캐릭터로만, 잔액 부족 시 402.
export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user)
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

    const body = await req.json();
    const provider = String(body.provider ?? "") as "google" | "openai";
    const poseRenderDataUrl = String(body.poseRenderDataUrl ?? "");
    const extraPrompt =
      typeof body.extraPrompt === "string" && body.extraPrompt.trim()
        ? body.extraPrompt
        : null;
    const pose = parsePoseState(body.pose);
    // 캡처 시점 마네킹들의 화면 위치 — 프롬프트에서 마네킹↔캐릭터를 잇는 근거.
    const layout = layoutSchema.parse(body.layout) ?? null;
    const idempotencyKey =
      typeof body.idempotencyKey === "string" && body.idempotencyKey
        ? body.idempotencyKey
        : nanoid(16);

    // 등장인물은 장면(pose.figures)이 단일 진실 공급원이다.
    const missing = unassignedFigureIds(pose);
    if (missing.length)
      return NextResponse.json(
        { error: "캐릭터가 배정되지 않은 피규어가 있습니다." },
        { status: 400 },
      );
    const characterIds = characterIdsFromPose(pose);
    if (!characterIds.length)
      return NextResponse.json(
        { error: "장면에 캐릭터가 없습니다." },
        { status: 400 },
      );

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

    // 등장인물 전원이 본인 캐릭터인지 확인 — 한 명이라도 아니면 거절.
    const charRes = await sb
      .from("characters")
      .select("id,owner")
      .in("id", characterIds);
    if (charRes.error) throw charRes.error;
    const owned = new Set(
      (charRes.data ?? [])
        .filter((c) => c.owner === user.id)
        .map((c) => c.id as string),
    );
    if (characterIds.some((id) => !owned.has(id)))
      return NextResponse.json(
        { error: "캐릭터를 찾을 수 없습니다." },
        { status: 404 },
      );

    // 대표 캐릭터 — 스토리지 경로 prefix와 갤러리 대표 이름에 쓰인다.
    const primaryId = characterIds[0];

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
    const renderPath = `${primaryId}/${nanoid(12)}.${renderExt}`;
    const rup = await sb.storage
      .from(RENDER_BUCKET)
      .upload(renderPath, render.buffer, {
        contentType: render.mime,
        upsert: false,
      });
    if (rup.error) throw rup.error;

    // 원자적 enqueue + 예약 차감 (잔액 부족 시 예외)
    const enq = await sb.rpc("enqueue_generation", {
      p_character_id: primaryId,
      p_provider: provider,
      p_pose: pose,
      p_render_path: renderPath,
      p_extra_prompt: extraPrompt,
      p_idempotency_key: idempotencyKey,
      p_owner: user.id,
      p_cost: 0, // 결제 OFF — 쿼터로 제한 (크레딧 인프라는 휴면)
      p_kind: "pose",
      p_character_ids: characterIds,
      p_figure_layout: layout,
    });
    if (enq.error) throw enq.error;
    const generationId = enq.data as string;

    // 비동기 처리 트리거: 시연 모드 → 데모 큐(지정 이미지), 아니면 Trigger.dev / 스텁
    const origin = process.env.APP_URL ?? req.nextUrl.origin;
    const queue = demo
      ? demoQueue
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
