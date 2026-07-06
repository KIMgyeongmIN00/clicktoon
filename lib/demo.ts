import { cookies } from "next/headers";
import crypto from "node:crypto";
import { DEMO_COOKIE } from "./demo-shared";

// 시연(demo) 모드 — 실제 AI 호출/워커 없이 지정 이미지로 생성을 흉내낸다.
// 빌드 플래그가 아니라 요청별 서명 쿠키로 판정하므로 배포 환경에서도 런타임 토글 가능.
// 켜진 브라우저만 시연 모드가 되고 실제 사용자는 영향 없음(per-browser). 쿼터도 무제한.
// 토글은 숨겨진 어드민 라우트(/api/admin/demo)에서 ADMIN_DEMO_SECRET로만 가능.

function adminSecret(): string {
  return process.env.ADMIN_DEMO_SECRET ?? "";
}

function sign(value: string): string {
  return crypto.createHmac("sha256", adminSecret()).update(value).digest("hex");
}

// 시크릿이 설정돼 있어야 시연 토글 자체가 활성화됨(미설정 → 기능 완전 비활성).
export function demoConfigured(): boolean {
  return adminSecret().length > 0;
}

// 서명된 시연 쿠키 토큰. 시크릿을 아는 사람만 유효 토큰을 만들 수 있다.
export function demoCookieToken(): string {
  return `1.${sign("1")}`;
}

// 요청의 서명 쿠키를 검증 → 이 브라우저가 시연 모드인지. per-browser·런타임.
export async function isDemoMode(): Promise<boolean> {
  if (!adminSecret()) return false;
  const raw = (await cookies()).get(DEMO_COOKIE)?.value;
  if (!raw) return false;
  const [v, sig] = raw.split(".");
  if (v !== "1" || !sig) return false;
  const a = Buffer.from(sig);
  const b = Buffer.from(sign("1"));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
