// 시연 모드 쿠키 이름 (서버·클라 공용, next/headers 미의존).
// ct_demo: httpOnly 서명 쿠키 — 서버가 신뢰하는 실제 상태.
// ct_demo_ui: 읽기 가능 — 배지 표시 전용(위조돼도 배지만 뜨고 동작은 안 바뀜).
export const DEMO_COOKIE = "ct_demo";
export const DEMO_UI_COOKIE = "ct_demo_ui";
