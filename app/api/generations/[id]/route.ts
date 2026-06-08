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
    const url = await signedUrl(RESULT_BUCKET, res.data.result_path);
    return NextResponse.json({ generation: res.data, result_url: url });
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
