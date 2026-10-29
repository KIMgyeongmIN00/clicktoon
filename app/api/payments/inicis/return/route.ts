import { NextRequest, NextResponse } from "next/server";
import { serverSupabase } from "@/lib/supabase/server";
import { REVIEW_MID, REVIEW_PACK_ID, reviewApprovalUrl } from "@/lib/payments/inicis-review";
import { SUBSCRIPTION_PLANS } from "@/lib/payments/plans";

const reviewPackIds = SUBSCRIPTION_PLANS.map((plan) => `${REVIEW_PACK_ID}-${plan.id}`);

// PC 결제창은 iframe, 모바일은 최상위 창에서 돌아오므로 같은 결과 화면으로 이동한다.
function result(req: NextRequest, status: "success" | "failed" | "unknown") {
  const url = new URL(`/charge?review=${status}`, req.url).toString();
  return new NextResponse(`<!doctype html><meta charset="utf-8"><script>window.top.location.replace(${JSON.stringify(url).replace(/</g, "\\u003c")})</script>`, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.formData();
    const get = (key: string) => String(data.get(key) ?? "");
    if (get("P_STATUS") !== "00") return result(req, "failed");
    const orderId = get("P_OID");
    const amount = get("P_AMT");
    const authTid = get("P_AUTH_TID");
    const url = reviewApprovalUrl(get("P_IDCNAME"));
    if (get("P_MID") !== REVIEW_MID || !url || !/^review_[\w-]{16}$/.test(orderId) || !/^\d{1,9}$/.test(amount) || !/^[A-Za-z0-9_-]{1,40}$/.test(authTid)) return result(req, "failed");

    const db = serverSupabase();
    // 선점 후에는 승인 API를 재호출하지 않는다. 실패·통신 불명은 수동 확인 대상.
    const claim = await db.from("payment_orders")
      .update({ status: "failed", fail_code: "INICIS_REVIEW_APPROVING", updated_at: new Date().toISOString() })
      .eq("order_id", orderId).in("pack_id", reviewPackIds).eq("amount", Number(amount)).eq("status", "pending")
      .select("order_id").maybeSingle();
    if (claim.error || !claim.data) return result(req, "unknown");

    const response = await fetch(url, {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ P_MID: REVIEW_MID, P_AUTH_TID: authTid, P_AMT: amount, P_CHARSET: "UTF-8" }),
      signal: AbortSignal.timeout(10000), redirect: "error",
    });
    const raw = await response.text();
    let approved: Record<string, string>;
    try { approved = JSON.parse(raw); } catch { approved = Object.fromEntries(new URLSearchParams(raw)); }
    if (!response.ok || approved.P_STATUS !== "00") {
      await db.from("payment_orders").update({ fail_code: "INICIS_REVIEW_DECLINED" }).eq("order_id", orderId);
      return result(req, "failed");
    }
    if (approved.P_MID !== REVIEW_MID || approved.P_OID !== orderId || approved.P_AMT !== amount || approved.P_AUTH_TID !== authTid || !approved.P_APPL_TID) return result(req, "unknown");
    const saved = await db.rpc("complete_inicis_review", { p_order_id: orderId, p_payment_key: approved.P_APPL_TID });
    return result(req, saved.error ? "unknown" : "success");
  } catch {
    return result(req, "unknown");
  }
}
