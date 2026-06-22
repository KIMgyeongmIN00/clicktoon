import { Provider } from "@/lib/providers/types";

// ───────────────────────────────────────────────────────────────────────────
// AI 생성 1건당 실비용 추정.
//
// TODO(pricing): 아래 값은 임시 추정치입니다. 각 모델의 실제 호출 단가
//   (Google Gemini image / OpenAI gpt-image)를 확인해 교체하세요. 이미지
//   크기·품질에 따라 단가가 달라질 수 있으므로, 확정되면 size별로 분기하세요.
// 차감: enqueue_generation RPC가 이 credits만큼 예약 차감(실패 시 환불). (Phase C)
// ───────────────────────────────────────────────────────────────────────────

/** 생성 1건당 추정 실비용 (KRW). 임시값. */
export const GENERATION_COST_KRW: Record<Provider, number> = {
  google: 70, // TODO 실단가 확인
  openai: 120, // TODO 실단가 확인
};

/** 1 크레딧 = ₩10 (임시 정책). TODO: 크레딧 단가 확정. */
export const KRW_PER_CREDIT = 10;

export function generationCost(provider: Provider): {
  krw: number;
  credits: number;
} {
  const krw = GENERATION_COST_KRW[provider] ?? 0;
  return { krw, credits: Math.ceil(krw / KRW_PER_CREDIT) };
}
