import { task } from "@trigger.dev/sdk";
import { createClient } from "@supabase/supabase-js";
import { adapters } from "@/lib/providers";
import { signPayload } from "@/lib/crypto/hmac";
import type { Provider } from "@/lib/providers/types";
import type { CharacterMeta } from "@/types/character";
import type { PoseState } from "@/types/pose";

// 순수 실행기 task — DB·장기 Storage 키 없음. 입력은 presigned URL로 받고, 결과는
// presigned 업로드 후 HMAC 콜백으로 Next에 알린다. (SDD §3, D2-B)
// 필요 env(Trigger.dev): GOOGLE_GEMINI_API_KEY, OPENAI_API_KEY,
//   NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, WORKER_CALLBACK_SECRET
type GeneratePayload = {
  generationId: string;
  provider: Provider;
  characterName: string;
  characterMeta: CharacterMeta;
  pose: PoseState;
  extraPrompt?: string | null;
  size: { w: number; h: number; aspect: string };
  refUrl: string;
  renderUrl: string;
  resultUpload: { bucket: string; path: string; token: string };
  callbackUrl: string;
};

async function fetchImage(url: string) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`download failed: ${r.status}`);
  return {
    buffer: Buffer.from(await r.arrayBuffer()),
    mime: r.headers.get("content-type") || "image/png",
  };
}

async function postCallback(
  callbackUrl: string,
  generationId: string,
  payload: Record<string, unknown>,
) {
  const secret = process.env.WORKER_CALLBACK_SECRET;
  if (!secret) throw new Error("WORKER_CALLBACK_SECRET missing in task env");
  const ts = String(Date.now());
  const body = JSON.stringify(payload);
  const r = await fetch(callbackUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Worker-Role": "worker",
      "X-Timestamp": ts,
      "X-Signature": signPayload(secret, ts, body, generationId),
    },
    body,
  });
  if (!r.ok) throw new Error(`callback failed: ${r.status} ${await r.text()}`);
}

export const generateImageTask = task({
  id: "generate-image",
  maxDuration: 3600, // 생성은 보통 <2분; 넉넉히. TIMED_OUT 시 onFailure 미호출 → backstop reaper로 보완.
  retry: { maxAttempts: 2 },
  run: async (payload: GeneratePayload) => {
    const [ref, render] = await Promise.all([
      fetchImage(payload.refUrl),
      fetchImage(payload.renderUrl),
    ]);
    const result = await adapters[payload.provider].generate({
      characterName: payload.characterName,
      characterMeta: payload.characterMeta,
      referenceImage: ref,
      poseRenderImage: render,
      pose: payload.pose,
      extraPrompt: payload.extraPrompt ?? undefined,
      size: payload.size,
    });

    // presigned 업로드 (anon 클라이언트 + 토큰 — service key 불필요)
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
    const up = await sb.storage
      .from(payload.resultUpload.bucket)
      .uploadToSignedUrl(
        payload.resultUpload.path,
        payload.resultUpload.token,
        result.buffer,
        { contentType: result.mime },
      );
    if (up.error) throw up.error;

    await postCallback(payload.callbackUrl, payload.generationId, {
      status: "done",
      result_path: payload.resultUpload.path,
      model: result.model,
      prompt: result.prompt,
    });
    return { generationId: payload.generationId };
  },
  onFailure: async ({
    payload,
    error,
  }: {
    payload: GeneratePayload;
    error: unknown;
  }) => {
    // 재시도 소진 후 1회 호출 → row를 failed로. (콜백 자체 실패는 backstop reaper가 정리)
    try {
      await postCallback(payload.callbackUrl, payload.generationId, {
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
      });
    } catch {
      /* swallow */
    }
  },
});
