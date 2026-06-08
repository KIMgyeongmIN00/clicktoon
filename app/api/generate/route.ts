import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import {
  REF_BUCKET,
  RESULT_BUCKET,
  serverSupabase,
  signedUrl,
} from "@/lib/supabase/server";
import { adapters } from "@/lib/providers";
import { CANVAS_SIZES, poseStateSchema } from "@/types/pose";
import { characterMetaSchema, Character } from "@/types/character";
import { dataUrlToBuffer } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const characterId = String(body.characterId ?? "");
    const provider = String(body.provider ?? "") as "google" | "openai";
    const poseRenderDataUrl = String(body.poseRenderDataUrl ?? "");
    const extraPrompt =
      typeof body.extraPrompt === "string" ? body.extraPrompt : undefined;
    const pose = poseStateSchema.parse(body.pose);
    const apiKeys = (body.apiKeys ?? {}) as {
      google?: string;
      openai?: string;
    };
    const aspect = (pose.aspect ?? "3:4") as keyof typeof CANVAS_SIZES;
    const dims = CANVAS_SIZES[aspect] ?? CANVAS_SIZES["3:4"];
    const size = { w: dims.w, h: dims.h, aspect };

    if (!characterId)
      return NextResponse.json(
        { error: "characterId required" },
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
    const charRes = await sb
      .from("characters")
      .select("*")
      .eq("id", characterId)
      .single();
    if (charRes.error) throw charRes.error;
    const character = charRes.data as Character;
    const meta = characterMetaSchema.parse(character.meta);

    const refDl = await sb.storage
      .from(REF_BUCKET)
      .download(character.ref_path);
    if (refDl.error || !refDl.data) throw refDl.error ?? new Error("ref download failed");
    const refBuffer = Buffer.from(await refDl.data.arrayBuffer());
    const refMime = refDl.data.type || "image/png";

    const poseRender = dataUrlToBuffer(poseRenderDataUrl);

    const result = await adapters[provider].generate({
      characterName: character.name,
      characterMeta: meta,
      referenceImage: { buffer: refBuffer, mime: refMime },
      poseRenderImage: { buffer: poseRender.buffer, mime: poseRender.mime },
      pose,
      extraPrompt,
      apiKey: apiKeys[provider],
      size,
    });

    const genId = nanoid(12);
    const ext =
      result.mime === "image/jpeg" || result.mime === "image/jpg"
        ? "jpg"
        : result.mime === "image/webp"
          ? "webp"
          : "png";
    const resultPath = `${characterId}/${genId}.${ext}`;
    const up = await sb.storage
      .from(RESULT_BUCKET)
      .upload(resultPath, result.buffer, {
        contentType: result.mime,
        upsert: false,
      });
    if (up.error) throw up.error;

    const insert = await sb
      .from("generations")
      .insert({
        character_id: characterId,
        provider,
        model: result.model,
        prompt: result.prompt,
        pose,
        result_path: resultPath,
      })
      .select("*")
      .single();
    if (insert.error) throw insert.error;

    const url = await signedUrl(RESULT_BUCKET, resultPath);
    return NextResponse.json({
      generation: insert.data,
      result_url: url,
    });
  } catch (e) {
    console.error("[generate]", e);
    const err = e as Error & { status?: number; retryable?: boolean };
    const upstream =
      err.status && err.status >= 400 && err.status < 600 ? err.status : 500;
    return NextResponse.json(
      {
        error: err.message,
        retryable: err.retryable === true,
        upstreamStatus: err.status,
      },
      { status: upstream },
    );
  }
}
