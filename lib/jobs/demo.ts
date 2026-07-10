import { nanoid } from "nanoid";
import { serverSupabase, RESULT_BUCKET } from "@/lib/supabase/server";
import { markProcessing, markDone, markFailed } from "@/lib/generation/finalize";
import type { JobQueue, GenerationJob } from "./queue";

// 시연용 지정 결과 이미지는 스토리지 results/_demo/* 에 미리 올려둔다
// (scripts/seed-demo.mjs 가 업로드). 데모 작업은 이를 결과 경로로 "복사"만 한다.
// 서버리스에서 fs·self-fetch·백그라운드(after) 없이 단일 Supabase 호출로 완료 → 안정적.
const DEMO_PREFIX = "_demo";
const DEMO_IMAGES = {
  sketch: "pose-a.png", // A = 스케치
  color: "pose-b.png", // B = 색상
  concept: "concept-a.png",
};

function pickDemoImage(kind: string, renderMode: string | undefined): string {
  if (kind === "concept") return DEMO_IMAGES.concept;
  return renderMode === "sketch" ? DEMO_IMAGES.sketch : DEMO_IMAGES.color;
}

// 실제 워커/AI 대신, 지정 이미지를 결과로 복사해 생성을 흉내낸다.
// 상태 전이(processing→done)·결과 저장·폴링·갤러리는 실제와 동일하게 동작.
async function runDemoJob(generationId: string): Promise<void> {
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

    const src = `${DEMO_PREFIX}/${pickDemoImage(kind, renderMode)}`;
    const resultPath = `${gen?.character_id ?? "demo"}/${nanoid(12)}.png`;
    const cp = await sb.storage.from(RESULT_BUCKET).copy(src, resultPath);
    if (cp.error) throw cp.error;

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

// 동기 실행: enqueue가 완료까지 await → 응답 시점에 이미 done.
// (서버리스에서 응답 후 백그라운드가 종료돼 멈추는 문제 회피)
export const demoQueue: JobQueue = {
  async enqueue(job: GenerationJob) {
    await runDemoJob(job.generationId);
  },
};
