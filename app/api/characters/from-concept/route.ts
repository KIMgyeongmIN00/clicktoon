import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { REF_BUCKET, serverSupabase } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/supabase/session";
import { characterMetaSchema } from "@/types/character";
import { generationCost } from "@/lib/credits/cost";
import { adapters } from "@/lib/providers";
import { stubQueue } from "@/lib/jobs/stub";
import { makeTriggerQueue } from "@/lib/jobs/trigger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_MIME = ["image/png", "image/jpeg", "image/webp"];
const MAX_BYTES = 10 * 1024 * 1024;

// 경로 B — 단일 러프 이미지로 캐릭터 생성 + AI 컨셉아트 job enqueue.
// FormData: file(File), thumb?(File), name, meta(JSON), provider?
export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user)
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const form = await req.formData();
    const file = form.get("file");
    const thumb = form.get("thumb");
    const name = String(form.get("name") ?? "").trim();
    const metaRaw = String(form.get("meta") ?? "{}");
    const provider = String(form.get("provider") ?? "google") as
      | "google"
      | "openai";

    if (!(file instanceof File) || file.size === 0)
      return NextResponse.json(
        { error: "캐릭터 이미지가 필요합니다." },
        { status: 400 },
      );
    if (!name)
      return NextResponse.json({ error: "name required" }, { status: 400 });
    if (!adapters[provider])
      return NextResponse.json(
        { error: `unknown provider: ${provider}` },
        { status: 400 },
      );
    for (const f of [file, ...(thumb instanceof File ? [thumb] : [])]) {
      if (!ALLOWED_MIME.includes(f.type))
        return NextResponse.json(
          { error: "PNG·JPG·WEBP 이미지만 업로드할 수 있어요." },
          { status: 400 },
        );
      if (f.size > MAX_BYTES)
        return NextResponse.json(
          { error: "이미지가 너무 큽니다 (최대 10MB)." },
          { status: 400 },
        );
    }
    const meta = characterMetaSchema.parse(JSON.parse(metaRaw));

    const cost = generationCost(provider).credits;
    const sb = serverSupabase();

    // 잔액 사전 확인 (원자적 재확인은 RPC)
    const wRes = await sb
      .from("wallets")
      .select("balance")
      .eq("user_id", user.id)
      .maybeSingle();
    if ((wRes.data?.balance ?? 0) < cost)
      return NextResponse.json(
        { error: "크레딧이 부족합니다.", code: "INSUFFICIENT_CREDITS" },
        { status: 402 },
      );

    // 러프 이미지 업로드 → 초기 ref
    const prefix = nanoid(12);
    const ext = file.type.includes("png")
      ? "png"
      : file.type.includes("webp")
        ? "webp"
        : "jpg";
    const refPath = `${prefix}/rough.${ext}`;
    const up = await sb.storage
      .from(REF_BUCKET)
      .upload(refPath, Buffer.from(await file.arrayBuffer()), {
        contentType: file.type,
        upsert: false,
      });
    if (up.error) throw up.error;

    let thumbPath: string | null = null;
    if (thumb instanceof File && thumb.size > 0) {
      thumbPath = `${prefix}/thumb.png`;
      const t = await sb.storage
        .from(REF_BUCKET)
        .upload(thumbPath, Buffer.from(await thumb.arrayBuffer()), {
          contentType: thumb.type,
          upsert: false,
        });
      if (t.error) throw t.error;
    }

    const insert = await sb
      .from("characters")
      .insert({
        name,
        ref_path: refPath,
        thumb_path: thumbPath,
        meta,
        owner: user.id,
      })
      .select("*")
      .single();
    if (insert.error) throw insert.error;
    const characterId = insert.data.id as string;

    const aRes = await sb.from("character_assets").insert({
      character_id: characterId,
      owner: user.id,
      kind: "front",
      path: refPath,
      sort: 0,
    });
    if (aRes.error) throw aRes.error;

    // 컨셉 생성 job enqueue (예약 차감 포함)
    const enq = await sb.rpc("enqueue_generation", {
      p_character_id: characterId,
      p_provider: provider,
      p_pose: {},
      p_render_path: null,
      p_extra_prompt: null,
      p_idempotency_key: nanoid(16),
      p_owner: user.id,
      p_cost: cost,
      p_kind: "concept",
    });
    if (enq.error) {
      if (enq.error.message.includes("INSUFFICIENT_CREDITS"))
        return NextResponse.json(
          { error: "크레딧이 부족합니다.", code: "INSUFFICIENT_CREDITS" },
          { status: 402 },
        );
      throw enq.error;
    }
    const generationId = enq.data as string;

    const origin = process.env.APP_URL ?? req.nextUrl.origin;
    const queue = process.env.TRIGGER_SECRET_KEY
      ? makeTriggerQueue(origin)
      : stubQueue;
    await queue.enqueue({ generationId });

    return NextResponse.json(
      {
        character: insert.data,
        generationId,
        cost: generationCost(provider),
      },
      { status: 202 },
    );
  } catch (e) {
    console.error("[characters/from-concept]", e);
    return NextResponse.json(
      { error: "내부 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
