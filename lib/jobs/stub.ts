import { serverSupabase } from "@/lib/supabase/server";
import { markProcessing, markDone, markFailed } from "@/lib/generation/finalize";
import { runGeneration } from "@/lib/generation/run";
import type { JobQueue, GenerationJob } from "./queue";

// Phase A 인프로세스 스텁: 워커를 같은 Node 프로세스에서 흉내낸다(enqueue 후
// fire-and-forget). 비동기 상태기계(queued→processing→done/failed)·폴링·실패 UI를
// Trigger.dev/AWS 없이 검증하기 위함이다.
// ⚠️ DEV/자체호스트 전용 — 서버리스에선 응답 후 실행이 보장되지 않음.
//    Phase B에서 Trigger.dev task + HMAC 콜백으로 교체한다.
async function process(generationId: string): Promise<void> {
  try {
    const claimed = await markProcessing(generationId);
    if (!claimed) return; // 이미 처리 중/완료 (멱등)
    const out = await runGeneration(generationId);
    await markDone(generationId, out);
  } catch (e) {
    await markFailed(generationId, (e as Error).message).catch(() => {});
  } finally {
    try {
      await serverSupabase()
        .from("job_outbox")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("generation_id", generationId);
    } catch {
      /* best-effort */
    }
  }
}

export const stubQueue: JobQueue = {
  async enqueue(job: GenerationJob) {
    // 응답을 막지 않도록 fire-and-forget
    void process(job.generationId);
  },
};
