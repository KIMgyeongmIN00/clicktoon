import { NextRequest, NextResponse } from "next/server";
import {
  RESULT_BUCKET,
  serverSupabase,
  signedUrl,
} from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    const sb = serverSupabase();
    const res = await sb
      .from("generations")
      .select("*")
      .eq("id", id)
      .single();
    if (res.error) throw res.error;
    const gen = res.data;
    // 완료 + 결과 경로가 있을 때만 서명 URL 발급 (queued/processing/failed은 null).
    const url =
      gen.status === "done" && gen.result_path
        ? await signedUrl(RESULT_BUCKET, gen.result_path)
        : null;
    return NextResponse.json({ generation: gen, result_url: url });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    const sb = serverSupabase();
    const res = await sb
      .from("generations")
      .select("result_path")
      .eq("id", id)
      .single();
    if (res.error) throw res.error;
    if (res.data.result_path)
      await sb.storage.from(RESULT_BUCKET).remove([res.data.result_path]);
    const del = await sb.from("generations").delete().eq("id", id);
    if (del.error) throw del.error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 },
    );
  }
}
