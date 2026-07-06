import { after } from "next/server";
import { nanoid } from "nanoid";
import { serverSupabase, RESULT_BUCKET } from "@/lib/supabase/server";
import { markProcessing, markDone, markFailed } from "@/lib/generation/finalize";
import type { JobQueue, GenerationJob } from "./queue";

// 시연용 지정 결과 이미지 (public/demo/*).
// 포즈 생성은 렌더 모드에 맞춰: 스케치→pose-a(라인아트), 색상→pose-b(채색).
const DEMO_IMAGES = {
  sketch: "pose-a.png", // A = 스케치
  color: "pose-b.png", // B = 색상
  concept: "concept-a.png",
};
const DEMO_DELAY_MS = 3500; // "생성 중" 상태를 시연에서 보여줄 시간

// generation 행에서 kind·renderMode를 읽어 시연 이미지를 고른다.
function pickDemoImage(kind: string, renderMode: string | undefined): string {
  if (kind === "concept") return DEMO_IMAGES.concept;
  return renderMode === "sketch" ? DEMO_IMAGES.sketch : DEMO_IMAGES.color;
}

// public/*는 서버리스(prod)에서 fs로 못 읽을 수 있으므로 공개 URL(/demo/*)로 가져온다.
// dev·prod 양쪽에서 동일하게 동작.
async function loadDemoImage(origin: string, file: string): Promise<Buffer> {
  const res = await fetch(new URL(`/demo/${file}`, origin));
  if (!res.ok) throw new Error(`demo image ${file}: HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

// 실제 워커/AI 대신, 지정 이미지를 결과로 업로드해 생성을 흉내낸다.
// 상태 전이(processing→done)·결과 저장·폴링·갤러리는 실제와 완전히 동일하게 동작.
async function runDemoJob(generationId: string, origin: string): Promise<void> {
  const sb = serverSupabase();
  try {
    const claimed = await markProcessing(generationId);
    if (!claimed) return;

    const { data: gen } = await sb
      .from("generations")
      .select("kind, character_id, pose")
      .eq("id", generationId)
      .single();
    const kind = (gen?.kind ?? "pose") as string;
    const renderMode = (gen?.pose as { renderMode?: string } | null)
      ?.renderMode;

    await new Promise((r) => setTimeout(r, DEMO_DELAY_MS));

    const buf = await loadDemoImage(origin, pickDemoImage(kind, renderMode));

    const resultPath = `${gen?.character_id ?? "demo"}/${nanoid(12)}.png`;
    const up = await sb.storage
      .from(RESULT_BUCKET)
      .upload(resultPath, buf, { contentType: "image/png", upsert: false });
    if (up.error) throw up.error;

    await markDone(generationId, {
      resultPath,
      model: "demo",
      prompt: "demo render (시연 모드)",
    });
  } catch (e) {
    await markFailed(generationId, (e as Error).message).catch(() => {});
  } finally {
    try {
      await sb
        .from("job_outbox")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("generation_id", generationId);
    } catch {
      /* best-effort */
    }
  }
}

// after()로 응답 이후에 실행 → 서버리스에서도 백그라운드 작업이 함수 종료로 끊기지 않는다.
export function makeDemoQueue(origin: string): JobQueue {
  return {
    async enqueue(job: GenerationJob) {
      after(() => runDemoJob(job.generationId, origin));
    },
  };
}
