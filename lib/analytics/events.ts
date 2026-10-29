import { z } from "zod";

const id = z.string().min(1).max(128);
const count = z.number().int().nonnegative();
const provider = z.enum(["google", "openai"]);
const kind = z.enum(["pose", "concept"]);
const scene = {
  provider,
  figure_count: count,
  aspect: z.enum(["1:1", "3:4", "4:3", "9:16", "16:9"]),
  render_mode: z.enum(["sketch", "color"]),
};

function event<S extends z.ZodRawShape, T extends "browser" | "server">(
  description: string,
  source: T,
  locations: string[],
  shape: S,
) {
  return { description, source, locations, schema: z.object(shape) };
}

/** Single source of truth: names, allowed properties, meaning and instrumentation sites. */
export const ANALYTICS_EVENTS = {
  page_viewed: event("페이지 진입·경로 변경 (쿼리 제외)", "browser", ["components/analytics-provider.tsx"], { page: id, referrer_host: z.string().max(253).optional(), utm_source: id.optional(), utm_medium: id.optional(), utm_campaign: id.optional() }),
  login_started: event("로그인 방식 선택 후 인증 요청", "browser", ["app/login/page.tsx"], { method: z.enum(["google", "password"]) }),
  login_completed: event("실제 SIGNED_IN 전이; 세션 복원 제외", "browser", ["components/analytics-provider.tsx"], {}),
  logout_completed: event("로그아웃 후 익명 식별자로 초기화", "browser", ["components/analytics-provider.tsx"], {}),
  character_creation_started: event("캐릭터 생성 모드 진입", "browser", ["app/(app)/characters/new/page.tsx"], { mode: z.enum(["upload", "concept"]) }),
  character_step_completed: event("업로드 퍼널 다음 단계 진행", "browser", ["app/(app)/characters/new/page.tsx"], { step: count }),
  character_created: event("사용자 저장 완료; 로그인 시 로컬 동기화는 중복 집계하지 않음", "browser", ["app/(app)/characters/new/page.tsx"], { mode: z.enum(["upload", "concept"]), storage: z.enum(["local", "server"]) }),
  character_selected: event("피규어에 캐릭터 직접 배정", "browser", ["app/(app)/page.tsx"], {}),
  pose_preset_applied: event("단일 또는 2인 프리셋 적용", "browser", ["app/(app)/page.tsx"], { preset_id: id, preset_type: z.enum(["single", "duo"]) }),
  pose_edited: event("직접 편집 입력을 1초 유휴 후 묶음 집계", "browser", ["app/(app)/page.tsx"], { edit_count: count }),
  figure_added: event("피규어 수동 추가 또는 2인 프리셋으로 추가", "browser", ["app/(app)/page.tsx"], { figure_count: count, via: z.enum(["manual", "duo_preset"]) }),
  figure_removed: event("피규어 제거", "browser", ["app/(app)/page.tsx"], { figure_count: count }),
  generation_requested: event("인증·캐릭터 검사 후 생성 시도; enqueue 성공과 구분", "browser", ["app/(app)/page.tsx", "app/(app)/characters/new/page.tsx"], { kind, ...scene }),
  generation_queued: event("DB enqueue 성공; 서버 작업 ID 기준", "server", ["app/api/generate/route.ts", "app/api/characters/from-concept/route.ts"], { generation_id: id, kind, provider }),
  generation_succeeded: event("비종료 → done 전이", "server", ["lib/generation/finalize.ts"], { generation_id: id, kind, provider, elapsed_ms: count }),
  generation_failed: event("비종료 → failed 전이; 원문 오류 제외", "server", ["lib/generation/finalize.ts", "app/api/jobs/reap/route.ts"], { generation_id: id, kind, provider, elapsed_ms: count, failure_type: z.enum(["rate_limit", "timeout", "content_policy", "other"]) }),
  generation_request_failed: event("HTTP 요청 단계 실패; 작업 최종 실패와 구분", "browser", ["app/(app)/page.tsx", "app/(app)/characters/new/page.tsx"], { kind, stage: z.enum(["http", "capture_or_network"]), status: count.optional() }),
  generation_retry_requested: event("실패 안내의 다시 시도 클릭; 실제 재요청 성공 아님", "browser", ["app/(app)/page.tsx", "app/(app)/characters/new/page.tsx"], { kind }),
  quota_limit_reached: event("서버에서 실제 무료 한도 초과 판정", "server", ["app/api/generate/route.ts", "app/api/characters/from-concept/route.ts"], { kind }),
  pose_capture_downloaded: event("포즈 미리보기 PNG 다운로드 시작; AI 생성 이미지 다운로드와 구분", "browser", ["app/(app)/page.tsx"], { figure_count: count }),
  checkout_started: event("서버 주문 발급 후 결제 SDK 호출 직전", "browser", ["lib/payments/inicis-review-client.ts", "lib/payments/toss.ts"], { order_id: id, amount: count, currency: z.literal("KRW") }),
  checkout_failed: event("주문/결제창 실행 중 예외; 사용자 취소 포함 가능", "browser", ["app/(app)/charge/page.tsx"], {}),
  payment_succeeded: event("서버 결제 승인 및 크레딧 적립 완료", "server", ["app/api/payments/confirm/route.ts"], { order_id: id, amount: count, credits: count, currency: z.literal("KRW") }),
  payment_failed: event("서버 결제 승인 거절", "server", ["app/api/payments/confirm/route.ts"], { order_id: id }),
} as const;

export type AnalyticsEvent = keyof typeof ANALYTICS_EVENTS;
export type EventProperties<E extends AnalyticsEvent> = z.input<(typeof ANALYTICS_EVENTS)[E]["schema"]>;
export type EventFor<S extends "browser" | "server"> = {
  [E in AnalyticsEvent]: (typeof ANALYTICS_EVENTS)[E]["source"] extends S ? E : never;
}[AnalyticsEvent];

export function validProperties<E extends AnalyticsEvent>(name: E, properties: EventProperties<E>) {
  const parsed = ANALYTICS_EVENTS[name].schema.safeParse(properties);
  return parsed.success ? parsed.data : null;
}
