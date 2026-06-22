import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import {
  REF_BUCKET,
  serverSupabase,
  signedUrl,
} from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/supabase/session";
import { characterMetaSchema } from "@/types/character";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user)
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const sb = serverSupabase();
    const { data, error } = await sb
      .from("characters")
      .select("*")
      .eq("owner", user.id)
      .order("created_at", { ascending: false });
    if (error) throw error;
    const items = await Promise.all(
      (data ?? []).map(async (row) => ({
        ...row,
        ref_url: await signedUrl(REF_BUCKET, row.ref_path),
        thumb_url: row.thumb_path
          ? await signedUrl(REF_BUCKET, row.thumb_path)
          : null,
      })),
    );
    return NextResponse.json({ items });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 },
    );
  }
}

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

    if (!(file instanceof File) || file.size === 0)
      return NextResponse.json(
        { error: "reference image file required" },
        { status: 400 },
      );
    if (!name)
      return NextResponse.json(
        { error: "name required" },
        { status: 400 },
      );

    const meta = characterMetaSchema.parse(JSON.parse(metaRaw));

    const sb = serverSupabase();
    const id = nanoid(12);
    const ext = guessExt(file.type, file.name);
    const refPath = `${id}/ref.${ext}`;
    const thumbPath =
      thumb instanceof File && thumb.size > 0
        ? `${id}/thumb.${guessExt(thumb.type, thumb.name)}`
        : null;

    const refBuf = Buffer.from(await file.arrayBuffer());
    const up = await sb.storage
      .from(REF_BUCKET)
      .upload(refPath, refBuf, { contentType: file.type, upsert: false });
    if (up.error) throw up.error;

    if (thumbPath && thumb instanceof File) {
      const thumbBuf = Buffer.from(await thumb.arrayBuffer());
      const t = await sb.storage
        .from(REF_BUCKET)
        .upload(thumbPath, thumbBuf, {
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

    return NextResponse.json({ character: insert.data });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 },
    );
  }
}

function guessExt(mime: string, filename?: string): string {
  if (mime.includes("png")) return "png";
  if (mime.includes("jpeg") || mime.includes("jpg")) return "jpg";
  if (mime.includes("webp")) return "webp";
  const m = /\.([a-z0-9]{2,5})$/i.exec(filename ?? "");
  return m ? m[1].toLowerCase() : "png";
}
