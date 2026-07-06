import { DEMO_UI_COOKIE } from "./demo-shared";

// 배지·안내 표시 전용(서버 신뢰 X). 실제 시연 동작은 서버가 httpOnly 서명 쿠키로 판정.
// 위조해도 UI 배지만 바뀌고 쿼터 우회/데모 큐는 서버에서 막힌다.
export function isDemoUi(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie.split("; ").some((c) => c === `${DEMO_UI_COOKIE}=1`);
}
