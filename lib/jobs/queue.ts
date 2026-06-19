// 큐에 넣는 생성 작업. 워커는 generationId만 필요 — 모든 입력은 generations row에
// 저장돼 있음. Phase A: 인프로세스 스텁이 row를 읽어 처리. Phase B: Trigger.dev
// 트리거 페이로드가 presigned URL을 실어 보냄(워커는 DB 접근 없이 동작).
export type GenerationJob = { generationId: string };

// 인프라 교체(스텁 ↔ Trigger.dev ↔ SQS)를 격리하기 위한 추상화.
export interface JobQueue {
  enqueue(job: GenerationJob): Promise<void>;
}
