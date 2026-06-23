import { createHmac, timingSafeEqual } from "node:crypto";

// 워커 콜백 서명. resourceId(예: generationId)와 timestamp를 본문과 함께 서명해
// 재생공격 + 다른 리소스로의 서명 재사용(cross-resource replay)을 막는다.
// 서명 대상: `${resourceId}.${timestamp}.${rawBody}`.
export function signPayload(
  secret: string,
  timestamp: string,
  rawBody: string,
  resourceId = "",
): string {
  return createHmac("sha256", secret)
    .update(`${resourceId}.${timestamp}.${rawBody}`)
    .digest("hex");
}

// 상수시간 비교로 서명 검증.
export function verifySignature(
  secret: string,
  timestamp: string,
  rawBody: string,
  signature: string,
  resourceId = "",
): boolean {
  const expected = signPayload(secret, timestamp, rawBody, resourceId);
  let a: Buffer;
  let b: Buffer;
  try {
    a = Buffer.from(expected, "hex");
    b = Buffer.from(signature ?? "", "hex");
  } catch {
    return false;
  }
  if (a.length === 0 || a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
