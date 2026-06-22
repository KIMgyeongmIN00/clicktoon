import { NextRequest, NextResponse } from "next/server";
import { verifySignature } from "@/lib/crypto/hmac";
import { serverSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Backstop reaper: 30분 넘게 queued/processing에 멈춰 있는 생성을 failed로 정리한다.
// (워커 사망·TIMED_OUT 등 콜백 없는 유실 대비 — SDD D5 / 사용자 #8)
// Trigger.dev 스케줄 task가 HMAC 서명으로 호출한다.
const MAX_SKEW_MS = 5 * 60 * 1000;
const STUCK_MINUTES = 30;

export async function POST(req: NextRequest) {
  try {
    const secret = process.env.WORKER_CALLBACK_SECRET;
    if (!secret)
      return NextResponse.json(
        { error: "WORKER_CALLBACK_SECRET가 설정되지 않았습니다." },
        { status: 500 },
      );

    const rawBody = await req.text();
    const signature = req.headers.get("x-signature") ?? "";
    const role = req.headers.get("x-worker-role") ?? "";
    const ts = req.headers.get("x-timestamp") ?? "";

    if (role !== "worker")
      return NextResponse.json({ error: "forbidden role" }, { status: 403 });
    const tsNum = Number(ts);
    if (!Number.isFinite(tsNum) || Math.abs(Date.now() - tsNum) > MAX_SKEW_MS)
      return NextResponse.json(
        { error: "stale or invalid timestamp" },
        { status: 401 },
      );
    if (!verifySignature(secret, ts, rawBody, signature))
      return NextResponse.json({ error: "invalid signature" }, { status: 401 });

    const cutoff = new Date(
      Date.now() - STUCK_MINUTES * 60 * 1000,
    ).toISOString();
    const sb = serverSupabase();
    const { data, error } = await sb
      .from("generations")
      .update({
        status: "failed",
        error_message: "시간 초과 — 워커 응답 없음 (backstop reaper)",
        updated_at: new Date().toISOString(),
      })
      .in("status", ["queued", "processing"])
      .lt("updated_at", cutoff)
      .is("result_path", null) // 결과가 이미 있으면(=완료) reap 금지 (안전 가드)
      .select("id");
    if (error) throw error;
    // reaped 건 예약 크레딧 환불 (멱등; 차감 없었으면 no-op).
    const ids = (data ?? []).map((r) => r.id as string);
    for (const id of ids) {
      await sb.rpc("credit_refund", { p_generation: id });
    }
    return NextResponse.json({ reaped: ids.length });
  } catch (e) {
    console.error("[jobs/reap]", e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
