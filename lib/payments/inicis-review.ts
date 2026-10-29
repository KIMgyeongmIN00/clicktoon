import { createHash } from "node:crypto";

// KG INIpayTest 공개 테스트 상점 전용. 실제 가맹점 키로 바꾸는 용도가 아니다.
export const REVIEW_MID = "INIpayTest";
const REVIEW_HASH_KEY = "3CB8183A4BE283555ACC8363C0360223";
export const REVIEW_PACK_ID = "inicis-review";

export function reviewHash(amount: number, orderId: string, timestamp: string) {
  return createHash("sha512")
    .update(`${amount}${orderId}${timestamp}${REVIEW_HASH_KEY}`, "utf8")
    .digest("base64");
}

export function reviewApprovalUrl(idc: string) {
  if (!["fc", "ks", "stg"].includes(idc)) return null;
  return `https://${idc}paypro.inicis.com/payment/v1/rest/payAppl.ini`;
}
