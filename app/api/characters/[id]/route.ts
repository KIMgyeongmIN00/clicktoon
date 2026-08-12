import { NextRequest, NextResponse } from "next/server";
import {
  REF_BUCKET,
  RESULT_BUCKET,
  serverSupabase,
  signedUrl,
} from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/supabase/session";
import { characterMetaSchema } from "@/types/character";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getSessionUser();
    if (!user)
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const { id } = await ctx.params;
    const sb = serverSupabase();
    const charRes = await sb
      .from("characters")
      .select("*")
      .eq("id", id)
      .eq("owner", user.id)
      .maybeSingle();
    if (charRes.error) throw charRes.error;
    if (!charRes.data)
      return NextResponse.json({ error: "not found" }, { status: 404 });

    const character = {
      ...charRes.data,
      ref_url: await signedUrl(REF_BUCKET, charRes.data.ref_path),
      thumb_url: charRes.data.thumb_path
        ? await signedUrl(REF_BUCKET, charRes.data.thumb_path)
        : null,
    };

    // 이 캐릭터가 "등장한" 모든 생성물. generations.character_id는 대표 캐릭터일
    // 뿐이므로 조인 테이블을 경유해야 조연으로 참여한 장면도 갤러리에 뜬다.
    const gcRes = await sb
      .from("generation_characters")
      .select("generation_id")
      .eq("character_id", id);
    if (gcRes.error) throw gcRes.error;
    const genIds = (gcRes.data ?? []).map((r) => r.generation_id as string);

    let generations: Record<string, unknown>[] = [];
    if (genIds.length) {
      const genRes = await sb
        .from("generations")
        .select("*")
        .in("id", genIds)
        .eq("owner", user.id)
        .order("created_at", { ascending: false });
      if (genRes.error) throw genRes.error;
      generations = await Promise.all(
        (genRes.data ?? []).map(async (g) => ({
          ...g,
          result_url:
            g.status === "done" && g.result_path
              ? await signedUrl(RESULT_BUCKET, g.result_path)
              : null,
        })),
      );
    }

    return NextResponse.json({ character, generations });
  } catch (e) {
    console.error("[characters/:id GET]", e);
    return NextResponse.json(
      { error: "내부 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getSessionUser();
    if (!user)
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const { id } = await ctx.params;
    const body = (await req.json()) as { name?: string; meta?: unknown };
    const update: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (typeof body.name === "string" && body.name.trim())
      update.name = body.name.trim();
    if (body.meta !== undefined)
      update.meta = characterMetaSchema.parse(body.meta);

    const sb = serverSupabase();
    const { data, error } = await sb
      .from("characters")
      .update(update)
      .eq("id", id)
      .eq("owner", user.id)
      .select("id");
    if (error) throw error;
    if (!data || data.length === 0)
      return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[characters/:id PATCH]", e);
    return NextResponse.json(
      { error: "내부 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getSessionUser();
    if (!user)
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const { id } = await ctx.params;
    const sb = serverSupabase();
    const charRes = await sb
      .from("characters")
      .select("ref_path,thumb_path")
      .eq("id", id)
      .eq("owner", user.id)
      .maybeSingle();
    if (charRes.error) throw charRes.error;
    if (!charRes.data)
      return NextResponse.json({ error: "not found" }, { status: 404 });

    const genRes = await sb
      .from("generations")
      .select("result_path")
      .eq("character_id", id)
      .eq("owner", user.id);
    if (genRes.error) throw genRes.error;

    const refPaths = [charRes.data.ref_path];
    if (charRes.data.thumb_path) refPaths.push(charRes.data.thumb_path);
    const resultPaths = (genRes.data ?? [])
      .map((g) => g.result_path)
      .filter((p): p is string => !!p);

    if (refPaths.length) await sb.storage.from(REF_BUCKET).remove(refPaths);
    if (resultPaths.length)
      await sb.storage.from(RESULT_BUCKET).remove(resultPaths);

    const del = await sb
      .from("characters")
      .delete()
      .eq("id", id)
      .eq("owner", user.id);
    if (del.error) throw del.error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[characters/:id DELETE]", e);
    return NextResponse.json(
      { error: "내부 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
