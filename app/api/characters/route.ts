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

const ALLOWED_MIME = ["image/png", "image/jpeg", "image/webp"];
const MAX_BYTES = 10 * 1024 * 1024; // 10MB

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
    console.error("[characters]", e);
    return NextResponse.json(
      { error: "내부 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}

// 멀티 시점(정면/옆면/뒷면) + 추가자료 업로드로 캐릭터 생성.
// FormData: front?, side?, back? (File), extra (File, 다중), thumb? (File), name, meta(JSON)
export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user)
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const form = await req.formData();
    const name = String(form.get("name") ?? "").trim();
    const metaRaw = String(form.get("meta") ?? "{}");
    const thumb = form.get("thumb");

    const views: { kind: "front" | "side" | "back"; file: File }[] = [];
    for (const kind of ["front", "side", "back"] as const) {
      const f = form.get(kind);
      if (f instanceof File && f.size > 0) views.push({ kind, file: f });
    }
    const extras = form
      .getAll("extra")
      .filter((f): f is File => f instanceof File && f.size > 0);

    if (views.length === 0)
      return NextResponse.json(
        { error: "최소 한 장의 캐릭터 이미지가 필요합니다." },
        { status: 400 },
      );
    if (!name)
      return NextResponse.json({ error: "name required" }, { status: 400 });

    // 모든 파일 검증
    const allFiles = [
      ...views.map((v) => v.file),
      ...extras,
      ...(thumb instanceof File ? [thumb] : []),
    ];
    for (const f of allFiles) {
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
    const sb = serverSupabase();
    const storagePrefix = nanoid(12); // 스토리지 경로용 (characters.id는 DB uuid)

    async function upload(file: File, label: string): Promise<string> {
      const path = `${storagePrefix}/${label}.${guessExt(file.type, file.name)}`;
      const buf = Buffer.from(await file.arrayBuffer());
      const up = await sb.storage
        .from(REF_BUCKET)
        .upload(path, buf, { contentType: file.type, upsert: false });
      if (up.error) throw up.error;
      return path;
    }

    // 업로드 → asset 메타 수집 (character_id는 insert 후 채움)
    const assets: { kind: string; path: string; sort: number }[] = [];
    const viewPaths = new Map<string, string>();
    for (const v of views) {
      const p = await upload(v.file, v.kind);
      viewPaths.set(v.kind, p);
      assets.push({ kind: v.kind, path: p, sort: 0 });
    }
    for (let i = 0; i < extras.length; i++) {
      const p = await upload(extras[i], `extra-${i}`);
      assets.push({ kind: "extra", path: p, sort: i });
    }

    // primary(생성 파이프라인이 쓰는 ref_path) = 정면 우선, 없으면 첫 시점
    const primaryPath = viewPaths.get("front") ?? viewPaths.get(views[0].kind)!;

    let thumbPath: string | null = null;
    if (thumb instanceof File && thumb.size > 0)
      thumbPath = await upload(thumb, "thumb");

    const insert = await sb
      .from("characters")
      .insert({
        name,
        ref_path: primaryPath,
        thumb_path: thumbPath,
        meta,
        owner: user.id,
      })
      .select("*")
      .single();
    if (insert.error) throw insert.error;
    const characterId = insert.data.id as string;

    if (assets.length) {
      const rows = assets.map((a) => ({
        character_id: characterId,
        owner: user.id,
        ...a,
      }));
      const aRes = await sb.from("character_assets").insert(rows);
      if (aRes.error) throw aRes.error;
    }

    return NextResponse.json({ character: insert.data });
  } catch (e) {
    console.error("[characters]", e);
    return NextResponse.json(
      { error: "내부 오류가 발생했습니다." },
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
