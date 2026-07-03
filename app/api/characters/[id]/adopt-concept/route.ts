import { NextRequest, NextResponse } from "next/server";
import {
  REF_BUCKET,
  RESULT_BUCKET,
  serverSupabase,
} from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/supabase/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 완성된 컨셉아트(generation 결과)를 캐릭터 대표 이미지(ref)로 채택.
// body: { generationId }
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getSessionUser();
    if (!user)
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const { id } = await ctx.params;
    const body = await req.json();
    const generationId = String(body.generationId ?? "");
    if (!generationId)
      return NextResponse.json(
        { error: "generationId required" },
        { status: 400 },
      );

    const sb = serverSupabase();
    const charRes = await sb
      .from("characters")
      .select("id, ref_path")
      .eq("id", id)
      .eq("owner", user.id)
      .maybeSingle();
    if (charRes.error) throw charRes.error;
    if (!charRes.data)
      return NextResponse.json({ error: "not found" }, { status: 404 });

    const genRes = await sb
      .from("generations")
      .select("id, character_id, owner, status, result_path")
      .eq("id", generationId)
      .eq("owner", user.id)
      .eq("character_id", id)
      .maybeSingle();
    if (genRes.error) throw genRes.error;
    if (!genRes.data || genRes.data.status !== "done" || !genRes.data.result_path)
      return NextResponse.json(
        { error: "완료된 생성 결과가 아닙니다." },
        { status: 400 },
      );

    // 결과(results 버킷) → refs 버킷 복사 후 대표 이미지 교체
    const dl = await sb.storage
      .from(RESULT_BUCKET)
      .download(genRes.data.result_path);
    if (dl.error || !dl.data)
      throw dl.error ?? new Error("result download failed");
    const buf = Buffer.from(await dl.data.arrayBuffer());
    const mime = dl.data.type || "image/png";
    const prefix = charRes.data.ref_path.split("/")[0];
    const newRefPath = `${prefix}/concept-${generationId.slice(0, 8)}.png`;
    const up = await sb.storage
      .from(REF_BUCKET)
      .upload(newRefPath, buf, { contentType: mime, upsert: true });
    if (up.error) throw up.error;

    const upd = await sb
      .from("characters")
      .update({
        ref_path: newRefPath,
        thumb_path: null, // 이전 러프 썸네일 무효화 (ref로 대체 표시)
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("owner", user.id);
    if (upd.error) throw upd.error;

    await sb.from("character_assets").insert({
      character_id: id,
      owner: user.id,
      kind: "front",
      path: newRefPath,
      sort: 1,
    });

    return NextResponse.json({ ok: true, ref_path: newRefPath });
  } catch (e) {
    console.error("[characters/:id/adopt-concept]", e);
    return NextResponse.json(
      { error: "내부 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
